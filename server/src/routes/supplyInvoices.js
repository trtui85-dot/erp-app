import { Router } from 'express';
import pool, { query } from '../db.js';
import { requireModule } from '../auth.js';

const router = Router();

router.get('/', requireModule('supplyInvoices'), async (req, res) => {
  try {
    const [invoices] = await query(`
      SELECT si.*, s.name as supplier_name, s.phone as supplier_phone
      FROM supply_invoices si
      JOIN suppliers s ON si.supplier_id = s.id
      ORDER BY si.date DESC
    `);
    return res.json(invoices);
  } catch (err) {
    console.error('List supply invoices error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

router.get('/:id', requireModule('supplyInvoices'), async (req, res) => {
  try {
    const [invoices] = await query(`
      SELECT si.*, s.name as supplier_name, s.phone as supplier_phone
      FROM supply_invoices si
      JOIN suppliers s ON si.supplier_id = s.id
      WHERE si.id = ?
    `, [req.params.id]);
    if (invoices.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    const [items] = await query(`
      SELECT sii.*, p.name as product_name, b.remaining_qty as batch_remaining_qty, b.batch_code
      FROM supply_invoice_items sii
      JOIN products p ON sii.product_id = p.id
      LEFT JOIN batches b ON sii.batch_id = b.id
      WHERE sii.invoice_id = ?
    `, [req.params.id]);
    return res.json({ ...invoices[0], items });
  } catch (err) {
    console.error('Get supply invoice error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

router.post('/', requireModule('supplyInvoices'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { supplier_id, date, notes, items } = req.body;
    if (!supplier_id || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'supplier_id and items are required' });
    }

    const supCheck = await conn.execute('SELECT id FROM suppliers WHERE id = ?', [supplier_id]);
    if (supCheck[0].length === 0) {
      return res.status(400).json({ error: 'Fournisseur introuvable (id: ' + supplier_id + ')' });
    }

    let total = 0;
    for (const item of items) {
      total += (item.qty || 0) * (item.purchase_price || 0);
    }

    const invoiceDate = date || new Date().toISOString().split('T')[0];

    const [invoiceResult] = await conn.execute(
      'INSERT INTO supply_invoices (supplier_id, date, total, notes, created_by) VALUES (?, ?, ?, ?, ?)',
      [supplier_id, invoiceDate, total, notes || null, req.user.id]
    );
    const invoiceId = invoiceResult.insertId;

    const createdItems = [];
    for (const item of items) {
      const [itemResult] = await conn.execute(
        'INSERT INTO supply_invoice_items (invoice_id, product_id, qty, unit, purchase_price, sale_price, expiry_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [invoiceId, item.product_id, item.qty, item.unit || 'kg', item.purchase_price, item.sale_price || item.purchase_price, item.expiry_date || null]
      );

      const [batchResult] = await conn.execute(
        'INSERT INTO batches (product_id, supplier_id, arrival_date, initial_qty, remaining_qty, unit, purchase_price, sale_price, expiry_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [item.product_id, supplier_id, invoiceDate, item.qty, item.qty, item.unit || 'kg', item.purchase_price, item.sale_price || item.purchase_price, item.expiry_date || null, null]
      );

      const batchCode = `B-${invoiceDate}-${String(batchResult.insertId).padStart(3, '0')}`;
      await conn.execute('UPDATE batches SET batch_code = ? WHERE id = ?', [batchCode, batchResult.insertId]);

      await conn.execute(
        'UPDATE supply_invoice_items SET batch_id = ? WHERE id = ?',
        [batchResult.insertId, itemResult.insertId]
      );

      createdItems.push({ id: itemResult.insertId, batch_id: batchResult.insertId, batch_code: batchCode });
    }

    await conn.execute(
      'UPDATE suppliers SET last_supply_date = ? WHERE id = ?',
      [invoiceDate, supplier_id]
    );

    await conn.commit();

    const [invoice] = await query('SELECT * FROM supply_invoices WHERE id = ?', [invoiceId]);
    const [invoiceItems] = await query('SELECT * FROM supply_invoice_items WHERE invoice_id = ?', [invoiceId]);
    return res.status(201).json({ ...invoice[0], items: invoiceItems });
  } catch (err) {
    await conn.rollback();
    console.error('Create supply invoice error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  } finally {
    conn.release();
  }
});

router.delete('/:id', requireModule('supplyInvoices'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [existing] = await conn.execute('SELECT * FROM supply_invoices WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const [items] = await conn.execute('SELECT batch_id FROM supply_invoice_items WHERE invoice_id = ?', [req.params.id]);
    for (const item of items) {
      if (item.batch_id) {
        await conn.execute('DELETE FROM batches WHERE id = ?', [item.batch_id]);
      }
    }

    await conn.execute('DELETE FROM supply_invoices WHERE id = ?', [req.params.id]);
    await conn.commit();
    return res.json({ message: 'Invoice deleted' });
  } catch (err) {
    await conn.rollback();
    console.error('Delete supply invoice error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  } finally {
    conn.release();
  }
});

export default router;
