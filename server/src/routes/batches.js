import { Router } from 'express';
import { query } from '../db.js';
import { requireModule, requireAny } from '../auth.js';

const router = Router();

router.get('/low-stock', requireAny('batches', 'pos'), async (req, res) => {
  try {
    const [batches] = await query(`
      SELECT b.*, p.name as product_name, p.min_stock, s.name as supplier_name
      FROM batches b
      JOIN products p ON b.product_id = p.id
      LEFT JOIN suppliers s ON b.supplier_id = s.id
      WHERE b.status = 'active' AND b.remaining_qty <= p.min_stock
      ORDER BY b.remaining_qty ASC
    `);
    return res.json(batches);
  } catch (err) {
    console.error('Low stock error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

router.get('/', requireAny('batches', 'pos'), async (req, res) => {
  try {
    let sql = `
      SELECT b.*, p.name as product_name, p.shelf_life_days, p.category_id, s.name as supplier_name,
        (CURRENT_DATE - b.arrival_date)::int as age_days,
        CASE
          WHEN b.remaining_qty <= 0 THEN 'finished'
          WHEN b.status = 'expired' THEN 'expired'
          WHEN (CURRENT_DATE - b.arrival_date)::int >= p.shelf_life_days * 0.75 THEN 'danger'
          WHEN (CURRENT_DATE - b.arrival_date)::int >= p.shelf_life_days * 0.40 THEN 'warning'
          ELSE 'fresh'
        END as health
      FROM batches b
      JOIN products p ON b.product_id = p.id
      LEFT JOIN suppliers s ON b.supplier_id = s.id
    `;
    const params = [];
    if (req.query.product_id) {
      sql += ' WHERE b.product_id = ?';
      params.push(req.query.product_id);
    }
    if (req.query.status) {
      sql += params.length ? ' AND' : ' WHERE';
      sql += ' b.status = ?';
      params.push(req.query.status);
    }
    sql += ' ORDER BY b.arrival_date ASC';
    const [batches] = await query(sql, params);
    return res.json(batches);
  } catch (err) {
    console.error('List batches error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

router.patch('/:id', requireModule('batches'), async (req, res) => {
  try {
    const { remaining_qty, status } = req.body;
    const [existing] = await query('SELECT * FROM batches WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    await query(
      'UPDATE batches SET remaining_qty = ?, status = ? WHERE id = ?',
      [
        remaining_qty !== undefined ? remaining_qty : existing[0].remaining_qty,
        status || existing[0].status,
        req.params.id
      ]
    );
    const [batch] = await query('SELECT * FROM batches WHERE id = ?', [req.params.id]);
    return res.json(batch[0]);
  } catch (err) {
    console.error('Update batch error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

export default router;
