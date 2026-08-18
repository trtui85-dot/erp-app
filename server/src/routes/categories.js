import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const [rows] = await query(`
      SELECT c.*,
        (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.active = 1) AS product_count,
        (SELECT COALESCE(SUM(b.remaining_qty * b.purchase_price), 0)
         FROM batches b
         JOIN products p ON p.id = b.product_id
         WHERE p.category_id = c.id AND b.status = 'active' AND b.remaining_qty > 0) AS stock_value,
        (SELECT COUNT(*) FROM batches b
         JOIN products p ON p.id = b.product_id
         WHERE p.category_id = c.id AND b.status = 'active' AND b.remaining_qty > 0
         AND b.expiry_date IS NOT NULL AND b.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 2 DAY)) AS danger_count
      FROM categories c
      WHERE c.active = 1
      ORDER BY c.sort_order, c.id
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/products', async (req, res) => {
  try {
    const [rows] = await query(`
      SELECT p.*,
        COALESCE(SUM(b.remaining_qty), 0) AS total_stock,
        (SELECT SUM(b2.remaining_qty * b2.purchase_price)
         FROM batches b2 WHERE b2.product_id = p.id AND b2.status = 'active' AND b2.remaining_qty > 0) AS stock_value,
        (SELECT COUNT(*) FROM batches b3
         WHERE b3.product_id = p.id AND b3.status = 'active' AND b3.remaining_qty > 0
         AND b3.expiry_date IS NOT NULL AND b3.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 2 DAY)) AS danger_batches
      FROM products p
      LEFT JOIN batches b ON b.product_id = p.id AND b.status = 'active' AND b.remaining_qty > 0
      WHERE p.category_id = ? AND p.active = 1
      GROUP BY p.id
      ORDER BY p.name
    `, [req.params.id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, name_ar, icon, color, sort_order } = req.body;
    const [result] = await query(
      'INSERT INTO categories (name, name_ar, icon, color, sort_order) VALUES (?, ?, ?, ?, ?)',
      [name, name_ar || null, icon || '📦', color || '#6b7280', sort_order || 0]
    );
    res.json({ id: result.insertId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id', async (req, res) => {
  try {
    const { name, name_ar, icon, color, sort_order, active } = req.body;
    const fields = [];
    const vals = [];
    if (name !== undefined) { fields.push('name=?'); vals.push(name); }
    if (name_ar !== undefined) { fields.push('name_ar=?'); vals.push(name_ar); }
    if (icon !== undefined) { fields.push('icon=?'); vals.push(icon); }
    if (color !== undefined) { fields.push('color=?'); vals.push(color); }
    if (sort_order !== undefined) { fields.push('sort_order=?'); vals.push(sort_order); }
    if (active !== undefined) { fields.push('active=?'); vals.push(active); }
    if (fields.length > 0) {
      vals.push(req.params.id);
      await query(`UPDATE categories SET ${fields.join(', ')} WHERE id=?`, vals);
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await query('UPDATE products SET category_id = NULL WHERE category_id = ?', [req.params.id]);
    await query('DELETE FROM categories WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
