import { Router } from 'express';
import { query } from '../db.js';
import { requireModule } from '../auth.js';

const router = Router();

router.get('/', requireModule('products'), async (req, res) => {
  try {
    const [products] = await query(`
      SELECT p.*, 
        (SELECT COUNT(*) FROM batches b WHERE b.product_id = p.id AND b.status = 'active') as batch_count,
        (SELECT COALESCE(SUM(b.remaining_qty), 0) FROM batches b WHERE b.product_id = p.id AND b.status = 'active') as total_stock,
        (SELECT COALESCE(SUM(b.sold_qty), 0) FROM batches b WHERE b.product_id = p.id) as total_sold,
        (SELECT COALESCE(SUM(b.wasted_qty), 0) FROM batches b WHERE b.product_id = p.id) as total_wasted
      FROM products p
      WHERE p.active = 1
      ORDER BY p.name
    `);
    return res.json(products);
  } catch (err) {
    console.error('List products error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

router.get('/sold', requireModule('products'), async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 1;
    const [sold] = await query(`
      SELECT
        p.id as product_id,
        p.name as product_name,
        p.unit,
        p.current_sale_price,
        COALESCE(SUM(sii.qty), 0) as qty_sold,
        COALESCE(SUM(sii.total), 0) as sales_total
      FROM sale_invoice_items sii
      JOIN sale_invoices si ON si.id = sii.invoice_id
      JOIN batches b ON b.id = sii.batch_id
      JOIN products p ON p.id = b.product_id
      WHERE si.date >= CURRENT_DATE - ?::int * INTERVAL '1 day'
      GROUP BY p.id, p.name, p.unit, p.current_sale_price
      ORDER BY qty_sold DESC
    `, [days]);
    return res.json(sold);
  } catch (err) {
    console.error('List sold products error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

router.get('/:id', requireModule('products'), async (req, res) => {
  try {
    const [products] = await query('SELECT * FROM products WHERE id = ? AND active = 1', [req.params.id]);
    if (products.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const [batches] = await query(
      `SELECT b.*, s.name as supplier_name,
        (CURRENT_DATE - b.arrival_date)::int as age_days,
        CASE
          WHEN b.remaining_qty <= 0 THEN 'finished'
          WHEN (CURRENT_DATE - b.arrival_date)::int >= p.shelf_life_days * 0.75 THEN 'danger'
          WHEN (CURRENT_DATE - b.arrival_date)::int >= p.shelf_life_days * 0.40 THEN 'warning'
          ELSE 'fresh'
        END as health
       FROM batches b
       LEFT JOIN suppliers s ON b.supplier_id = s.id
       CROSS JOIN products p
       WHERE b.product_id = ? AND b.status = 'active' AND p.id = ?
       ORDER BY b.arrival_date ASC`,
      [req.params.id, req.params.id]
    );
    return res.json({ ...products[0], batches });
  } catch (err) {
    console.error('Get product error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

router.post('/', requireModule('products'), async (req, res) => {
  try {
    const { name, unit, price_type, current_sale_price, min_stock, shelf_life_days, category_id } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    const [result] = await query(
      'INSERT INTO products (name, unit, price_type, current_sale_price, min_stock, shelf_life_days, category_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, unit || 'kg', price_type || 'fixed', current_sale_price || 0, min_stock || 20, shelf_life_days || 5, category_id || null]
    );
    const [product] = await query('SELECT * FROM products WHERE id = ?', [result.insertId]);
    return res.status(201).json(product[0]);
  } catch (err) {
    console.error('Create product error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

router.patch('/:id', requireModule('products'), async (req, res) => {
  try {
    const { name, unit, price_type, current_sale_price, min_stock, shelf_life_days, category_id } = req.body;
    const [existing] = await query('SELECT * FROM products WHERE id = ? AND active = 1', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    await query(
      'UPDATE products SET name = ?, unit = ?, price_type = ?, current_sale_price = ?, min_stock = ?, shelf_life_days = ?, category_id = ? WHERE id = ?',
      [
        name || existing[0].name,
        unit || existing[0].unit,
        price_type || existing[0].price_type,
        current_sale_price !== undefined ? current_sale_price : existing[0].current_sale_price,
        min_stock !== undefined ? min_stock : existing[0].min_stock,
        shelf_life_days !== undefined ? shelf_life_days : existing[0].shelf_life_days,
        category_id !== undefined ? (category_id || null) : existing[0].category_id,
        req.params.id
      ]
    );
    const [product] = await query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    return res.json(product[0]);
  } catch (err) {
    console.error('Update product error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

router.delete('/:id', requireModule('products'), async (req, res) => {
  try {
    const [existing] = await query('SELECT * FROM products WHERE id = ? AND active = 1', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    await query('UPDATE products SET active = 0 WHERE id = ?', [req.params.id]);
    return res.json({ message: 'Product deleted' });
  } catch (err) {
    console.error('Delete product error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

export default router;
