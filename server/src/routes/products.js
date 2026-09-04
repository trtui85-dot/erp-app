import { Router } from 'express';
import { query } from '../db.js';
import { requireModule, requireAny } from '../auth.js';

const router = Router();

router.get('/', requireAny('products', 'pos', 'dailyPrices', 'supplyInvoices', 'otherSales'), async (req, res) => {
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

    const [units] = await query(`SELECT pu.*, c.name_ar AS category_name_ar FROM product_units pu
      JOIN products p ON p.id = pu.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE pu.active = 1 ORDER BY pu.id`);

    const unitsByProduct = {};
    for (const u of units) {
      if (!unitsByProduct[u.product_id]) unitsByProduct[u.product_id] = [];
      unitsByProduct[u.product_id].push(u);
    }
    const result = products.map((p) => ({ ...p, units: unitsByProduct[p.id] || [] }));
    return res.json(result);
  } catch (err) {
    console.error('List products error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

router.get('/sold', requireAny('products','pos','dailyPrices','supplyInvoices'), async (req, res) => {
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

router.get('/:id', requireAny('products','pos','dailyPrices','supplyInvoices'), async (req, res) => {
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
    const { name, unit, price_type, current_sale_price, min_stock, shelf_life_days, category_id, units } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    const [result] = await query(
      'INSERT INTO products (name, unit, price_type, current_sale_price, min_stock, shelf_life_days, category_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, unit || 'كيس', price_type || 'fixed', current_sale_price || 0, min_stock || 20, shelf_life_days || 5, category_id || null]
    );
    const newId = result.insertId;
    const unitsArr = (units && units.length) ? units : [{ unit: unit || 'كيس', current_sale_price: current_sale_price || 0, purchase_price: current_sale_price || 0, min_stock: min_stock || 0 }];
    for (const u of unitsArr) {
      await query(
        'INSERT INTO product_units (product_id, unit, price_type, current_sale_price, purchase_price, min_stock) VALUES (?, ?, ?, ?, ?, ?)',
        [newId, u.unit || 'كيس', u.price_type || 'fixed', u.current_sale_price || 0, u.purchase_price || 0, u.min_stock || 0]
      );
    }
    const [product] = await query('SELECT * FROM products WHERE id = ?', [newId]);
    return res.status(201).json(product[0]);
  } catch (err) {
    console.error('Create product error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

// === Product units (multi-unit) CRUD ===
router.get('/:id/units', requireModule('products'), async (req, res) => {
  try {
    const [units] = await query('SELECT * FROM product_units WHERE product_id = ? ORDER BY active DESC, id', [req.params.id]);
    return res.json(units);
  } catch (err) {
    console.error('List units error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

router.post('/:id/units', requireModule('products'), async (req, res) => {
  try {
    const { unit, current_sale_price, purchase_price, min_stock, price_type } = req.body;
    if (!unit) return res.status(400).json({ error: 'Unit is required' });
    const [result] = await query(
      'INSERT INTO product_units (product_id, unit, price_type, current_sale_price, purchase_price, min_stock) VALUES (?, ?, ?, ?, ?, ?)',
      [req.params.id, unit, price_type || 'fixed', current_sale_price || 0, purchase_price || 0, min_stock || 0]
    );
    const [unitRow] = await query('SELECT * FROM product_units WHERE id = ?', [result.insertId]);
    return res.status(201).json(unitRow[0]);
  } catch (err) {
    console.error('Create unit error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

router.patch('/units/:unitId', requireModule('products'), async (req, res) => {
  try {
    const { unit, current_sale_price, purchase_price, min_stock, price_type, active } = req.body;
    const [existing] = await query('SELECT * FROM product_units WHERE id = ?', [req.params.unitId]);
    if (existing.length === 0) return res.status(404).json({ error: 'Unit not found' });
    await query(
      'UPDATE product_units SET unit = ?, price_type = ?, current_sale_price = ?, purchase_price = ?, min_stock = ?, active = ? WHERE id = ?',
      [
        unit || existing[0].unit,
        price_type !== undefined ? price_type : existing[0].price_type,
        current_sale_price !== undefined ? current_sale_price : existing[0].current_sale_price,
        purchase_price !== undefined ? purchase_price : existing[0].purchase_price,
        min_stock !== undefined ? min_stock : existing[0].min_stock,
        active !== undefined ? active : existing[0].active,
        req.params.unitId
      ]
    );
    const [unitRow] = await query('SELECT * FROM product_units WHERE id = ?', [req.params.unitId]);
    return res.json(unitRow[0]);
  } catch (err) {
    console.error('Update unit error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

router.delete('/units/:unitId', requireModule('products'), async (req, res) => {
  try {
    const [existing] = await query('SELECT * FROM product_units WHERE id = ?', [req.params.unitId]);
    if (existing.length === 0) return res.status(404).json({ error: 'Unit not found' });
    await query('UPDATE product_units SET active = 0 WHERE id = ?', [req.params.unitId]);
    return res.json({ message: 'Unit deactivated' });
  } catch (err) {
    console.error('Delete unit error:', err);
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
