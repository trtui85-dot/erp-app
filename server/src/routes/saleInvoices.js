import { Router } from 'express';
import pool, { query } from '../db.js';
import { requireModule, requireAny } from '../auth.js';

const router = Router();

router.get('/', requireAny('saleInvoices', 'pos'), async (req, res) => {
  try {
    const [invoices] = await query(`
      SELECT si.*, c.name as customer_name, c.phone as customer_phone, pm.name AS payment_method_name, pm.icon AS payment_method_icon
      FROM sale_invoices si
      LEFT JOIN customers c ON si.customer_id = c.id
      LEFT JOIN payment_methods pm ON si.payment_method_id = pm.id
      ORDER BY si.id DESC
    `);
    return res.json(invoices);
  } catch (err) {
    console.error('List sale invoices error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

router.get('/:id', requireAny('saleInvoices', 'pos'), async (req, res) => {
  try {
    const [invoices] = await query(`
      SELECT si.*, c.name as customer_name, c.phone as customer_phone, pm.name AS payment_method_name
      FROM sale_invoices si
      LEFT JOIN customers c ON si.customer_id = c.id
      LEFT JOIN payment_methods pm ON si.payment_method_id = pm.id
      WHERE si.id = ?
    `, [req.params.id]);
    if (invoices.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    const [items] = await query(`
      SELECT sii.*, COALESCE(sii.product_name, p.name) as product_name, b.batch_code, b.remaining_qty as batch_remaining_qty
      FROM sale_invoice_items sii
      LEFT JOIN batches b ON sii.batch_id = b.id
      LEFT JOIN products p ON p.id = sii.product_id
      WHERE sii.invoice_id = ?
    `, [req.params.id]);
    return res.json({ ...invoices[0], items });
  } catch (err) {
    console.error('Get sale invoice error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

router.post('/', requireAny('saleInvoices', 'pos'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { customer_id, date, type, paid, notes, items, payment_method_id } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items are required' });
    }

    for (const item of items) {
      if (item.batch_id) {
        const [batch] = await conn.execute(
          'SELECT * FROM batches WHERE id = ? AND status = ?',
          [item.batch_id, 'active']
        );
        if (batch.length === 0) {
          await conn.rollback();
          return res.status(400).json({ error: `Batch ${item.batch_id} not found or not active` });
        }
        if (parseFloat(batch[0].remaining_qty) < parseFloat(item.qty)) {
          await conn.rollback();
          return res.status(400).json({ error: `Insufficient stock in batch ${batch[0].batch_code || item.batch_id}. Available: ${batch[0].remaining_qty}` });
        }
      } else if (!item.product_name) {
        await conn.rollback();
        return res.status(400).json({ error: 'Items need a batch_id or a product_name' });
      }
    }

    let total = 0;
    for (const item of items) {
      total += (item.qty || 0) * (item.price || 0);
    }
    const paidAmount = parseFloat(paid) || 0;
    const invoiceDate = date || new Date().toISOString().split('T')[0];
    const year = new Date(invoiceDate).getFullYear();

    const [codeCount] = await conn.execute("SELECT COUNT(*) AS c FROM sale_invoices WHERE EXTRACT(YEAR FROM date) = ?", [year]);
    const seq = (codeCount[0].c || 0) + 1;
    const invoiceCode = `${seq}/${year}`;

    const [invoiceResult] = await conn.execute(
      'INSERT INTO sale_invoices (customer_id, date, type, total, paid, notes, created_by, payment_method_id, invoice_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [customer_id || null, invoiceDate, type || 'retail', total, paidAmount, notes || null, req.user.id, payment_method_id || null, invoiceCode]
    );
    const invoiceId = invoiceResult.insertId;

    for (const item of items) {
      const itemTotal = (item.qty || 0) * (item.price || 0);
      const isFree = !item.batch_id;
      let productId = item.product_id || null;
      let productUnitId = item.product_unit_id || null;
      if (isFree && item.product_name) {
        productId = null;
      } else if (!productUnitId && item.batch_id) {
        const [bRow] = await conn.execute('SELECT product_unit_id FROM batches WHERE id = ?', [item.batch_id]);
        if (bRow.length > 0) productUnitId = bRow[0].product_unit_id || null;
      }
      await conn.execute(
        'INSERT INTO sale_invoice_items (invoice_id, batch_id, product_id, product_unit_id, product_name, qty, price, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [invoiceId, item.batch_id || null, productId, productUnitId, item.product_name || null, item.qty, item.price, itemTotal]
      );
      if (!isFree) {
        await conn.execute(
          'UPDATE batches SET remaining_qty = remaining_qty - ?, sold_qty = sold_qty + ? WHERE id = ?',
          [item.qty, item.qty, item.batch_id]
        );

        const [updatedBatch] = await conn.execute('SELECT remaining_qty FROM batches WHERE id = ?', [item.batch_id]);
        if (parseFloat(updatedBatch[0].remaining_qty) <= 0) {
          await conn.execute('UPDATE batches SET status = ? WHERE id = ?', ['sold', item.batch_id]);
        }
      }
    }

    if (paidAmount > 0 && payment_method_id) {
      const [balance] = await conn.execute(`
        SELECT COALESCE(SUM(CASE
          WHEN ref_type IN ('deposit','sale') AND to_payment_method_id = ? THEN amount
          WHEN ref_type IN ('withdrawal','purchase') AND from_payment_method_id = ? THEN -amount
          WHEN ref_type = 'transfer' AND to_payment_method_id = ? THEN amount
          WHEN ref_type = 'transfer' AND from_payment_method_id = ? THEN -amount
          ELSE 0 END), 0) AS bal FROM transactions
      `, [payment_method_id, payment_method_id, payment_method_id, payment_method_id]);
      const newBalance = Number(balance[0].bal) + Number(paidAmount);
      await conn.execute(
        'INSERT INTO transactions (ref_type, ref_id, to_payment_method_id, amount, balance_after, note, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ['sale', invoiceId, payment_method_id, paidAmount, newBalance, `Sale invoice ${invoiceCode}`, req.user.id]
      );
    }

    if (total > paidAmount && customer_id) {
      const debtAmount = total - paidAmount;
      await conn.execute(
        'INSERT INTO debts (customer_id, sale_invoice_id, amount, paid, status, created_date) VALUES (?, ?, ?, ?, ?, ?)',
        [customer_id, invoiceId, debtAmount, 0, 'pending', invoiceDate]
      );
    }

    await conn.commit();

    const [invoice] = await query('SELECT * FROM sale_invoices WHERE id = ?', [invoiceId]);
    const [invoiceItems] = await query('SELECT sii.*, COALESCE(sii.product_name, p.name) AS product_name FROM sale_invoice_items sii LEFT JOIN batches b ON sii.batch_id = b.id LEFT JOIN products p ON p.id = sii.product_id WHERE invoice_id = ?', [invoiceId]);
    return res.status(201).json({ ...invoice[0], items: invoiceItems });
  } catch (err) {
    await conn.rollback();
    console.error('Create sale invoice error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  } finally {
    conn.release();
  }
});

router.delete('/:id', requireAny('saleInvoices', 'pos'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [existing] = await conn.execute('SELECT * FROM sale_invoices WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const [items] = await conn.execute('SELECT * FROM sale_invoice_items WHERE invoice_id = ?', [req.params.id]);
    for (const item of items) {
      if (!item.batch_id) continue;
      await conn.execute(
        'UPDATE batches SET remaining_qty = remaining_qty + ?, sold_qty = sold_qty - ? WHERE id = ?',
        [item.qty, item.qty, item.batch_id]
      );
      const [batch] = await conn.execute('SELECT remaining_qty FROM batches WHERE id = ?', [item.batch_id]);
      if (parseFloat(batch[0].remaining_qty) > 0) {
        await conn.execute('UPDATE batches SET status = ? WHERE id = ?', ['active', item.batch_id]);
      }
    }

    if (existing[0].paid > 0 && existing[0].payment_method_id) {
      const [balance] = await conn.execute(`
        SELECT COALESCE(SUM(CASE
          WHEN ref_type IN ('deposit','sale') AND to_payment_method_id = ? THEN amount
          WHEN ref_type IN ('withdrawal','purchase') AND from_payment_method_id = ? THEN -amount
          WHEN ref_type = 'transfer' AND to_payment_method_id = ? THEN amount
          WHEN ref_type = 'transfer' AND from_payment_method_id = ? THEN -amount
          ELSE 0 END), 0) AS bal FROM transactions
      `, [existing[0].payment_method_id, existing[0].payment_method_id, existing[0].payment_method_id, existing[0].payment_method_id]);
      const newBalance = Number(balance[0].bal) - Number(existing[0].paid);
      await conn.execute(
        'INSERT INTO transactions (ref_type, ref_id, from_payment_method_id, amount, balance_after, note, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ['withdrawal', existing[0].id, existing[0].payment_method_id, existing[0].paid, newBalance, `Reversal invoice ${existing[0].invoice_code}`, req.user.id]
      );
    }

    await conn.execute('DELETE FROM sale_invoice_items WHERE invoice_id = ?', [req.params.id]);
    await conn.execute('DELETE FROM debts WHERE sale_invoice_id = ?', [req.params.id]);
    await conn.execute('DELETE FROM sale_invoices WHERE id = ?', [req.params.id]);
    await conn.commit();
    return res.json({ message: 'Invoice deleted and stock restored' });
  } catch (err) {
    await conn.rollback();
    console.error('Delete sale invoice error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  } finally {
    conn.release();
  }
});

export default router;
