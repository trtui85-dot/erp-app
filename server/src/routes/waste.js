import { Router } from 'express';
import pool, { query } from '../db.js';
import { requireModule } from '../auth.js';

const router = Router();

router.get('/', requireModule('batches'), async (req, res) => {
  try {
    let sql = `
      SELECT w.*, p.name as product_name, b.batch_code, b.purchase_price
      FROM waste_records w
      JOIN products p ON w.product_id = p.id
      JOIN batches b ON w.batch_id = b.id
    `;
    const params = [];
    if (req.query.product_id) {
      sql += ' WHERE w.product_id = ?';
      params.push(req.query.product_id);
    }
    if (req.query.from_date) {
      sql += params.length ? ' AND' : ' WHERE';
      sql += ' w.date >= ?';
      params.push(req.query.from_date);
    }
    if (req.query.to_date) {
      sql += params.length ? ' AND' : ' WHERE';
      sql += ' w.date <= ?';
      params.push(req.query.to_date);
    }
    sql += ' ORDER BY w.date DESC';
    const [records] = await query(sql, params);
    return res.json(records);
  } catch (err) {
    console.error('List waste records error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

router.get('/summary', requireModule('batches'), async (req, res) => {
  try {
    const [summary] = await query(`
      SELECT
        p.id as product_id,
        p.name as product_name,
        COALESCE(SUM(w.qty), 0) as total_wasted,
        COALESCE(SUM(w.loss_value), 0) as total_loss,
        (SELECT COALESCE(SUM(b.initial_qty), 0) FROM batches b WHERE b.product_id = p.id) as total_purchased,
        CASE
          WHEN (SELECT COALESCE(SUM(b.initial_qty), 0) FROM batches b WHERE b.product_id = p.id) > 0
          THEN ROUND(COALESCE(SUM(w.qty), 0) / (SELECT COALESCE(SUM(b.initial_qty), 0) FROM batches b WHERE b.product_id = p.id) * 100, 1)
          ELSE 0
        END as waste_pct
      FROM products p
      LEFT JOIN waste_records w ON w.product_id = p.id
      WHERE p.active = 1
      GROUP BY p.id, p.name
      HAVING total_wasted > 0
      ORDER BY waste_pct DESC
    `);
    return res.json(summary);
  } catch (err) {
    console.error('Waste summary error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

router.post('/', requireModule('batches'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { batch_id, qty, reason, date, notes } = req.body;
    if (!batch_id || !qty || qty <= 0) {
      return res.status(400).json({ error: 'batch_id and positive qty are required' });
    }

    const [batch] = await conn.execute(
      'SELECT b.*, p.name as product_name FROM batches b JOIN products p ON b.product_id = p.id WHERE b.id = ? AND b.status = ?',
      [batch_id, 'active']
    );
    if (batch.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Batch not found or not active' });
    }
    if (parseFloat(batch[0].remaining_qty) < parseFloat(qty)) {
      await conn.rollback();
      return res.status(400).json({ error: `Insufficient remaining qty: ${batch[0].remaining_qty}` });
    }

    const purchasePrice = parseFloat(batch[0].purchase_price);
    const wasteQty = parseFloat(qty);
    const lossValue = wasteQty * purchasePrice;
    const wasteDate = date || new Date().toISOString().split('T')[0];

    const [result] = await conn.execute(
      'INSERT INTO waste_records (batch_id, product_id, qty, reason, loss_value, date, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [batch_id, batch[0].product_id, qty, reason || 'rotten', lossValue, wasteDate, notes || null, req.user.id]
    );

    await conn.execute(
      'UPDATE batches SET remaining_qty = remaining_qty - ?, wasted_qty = wasted_qty + ? WHERE id = ?',
      [qty, qty, batch_id]
    );

    const [updatedBatch] = await conn.execute('SELECT remaining_qty FROM batches WHERE id = ?', [batch_id]);
    if (parseFloat(updatedBatch[0].remaining_qty) <= 0) {
      await conn.execute('UPDATE batches SET status = ? WHERE id = ?', ['cleared', batch_id]);
    }

    await conn.commit();

    return res.status(201).json({
      id: result.insertId,
      batch_id,
      product_name: batch[0].product_name,
      qty: wasteQty,
      reason: reason || 'rotten',
      loss_value: lossValue,
      date: wasteDate
    });
  } catch (err) {
    await conn.rollback();
    console.error('Create waste record error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  } finally {
    conn.release();
  }
});

router.delete('/:id', requireModule('batches'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [existing] = await conn.execute('SELECT * FROM waste_records WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Record not found' });
    }

    await conn.execute(
      'UPDATE batches SET remaining_qty = remaining_qty + ?, wasted_qty = wasted_qty - ? WHERE id = ?',
      [existing[0].qty, existing[0].qty, existing[0].batch_id]
    );

    const [batch] = await conn.execute('SELECT remaining_qty FROM batches WHERE id = ?', [existing[0].batch_id]);
    if (parseFloat(batch[0].remaining_qty) > 0) {
      await conn.execute('UPDATE batches SET status = ? WHERE id = ?', ['active', existing[0].batch_id]);
    }

    await conn.execute('DELETE FROM waste_records WHERE id = ?', [req.params.id]);
    await conn.commit();
    return res.json({ message: 'Waste record deleted and stock restored' });
  } catch (err) {
    await conn.rollback();
    console.error('Delete waste record error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  } finally {
    conn.release();
  }
});

export default router;
