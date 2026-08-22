import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

router.get('/profit', async (req, res) => {
  try {
    const { from_date, to_date } = req.query;
    let dateFilter = '';
    const params = [];
    if (from_date) { dateFilter += ' AND si.date >= ?'; params.push(from_date); }
    if (to_date) { dateFilter += ' AND si.date <= ?'; params.push(to_date); }

    const [profit] = await query(`
      SELECT
        p.id as product_id,
        p.name as product_name,
        p.unit,
        COALESCE(SUM(sii.qty), 0) as qty_sold,
        COALESCE(SUM(sii.total), 0) as revenue,
        COALESCE(SUM(sii.qty * b.purchase_price), 0) as cost_of_goods,
        COALESCE(SUM(sii.total) - SUM(sii.qty * b.purchase_price), 0) as gross_profit,
        COALESCE((SELECT SUM(w.loss_value) FROM waste_records w WHERE w.product_id = p.id), 0) as waste_loss,
        COALESCE(SUM(sii.total), 0) - COALESCE(SUM(sii.qty * b.purchase_price), 0) - COALESCE((SELECT SUM(w.loss_value) FROM waste_records w WHERE w.product_id = p.id), 0) as net_profit
      FROM products p
      LEFT JOIN batches b ON b.product_id = p.id
      LEFT JOIN sale_invoice_items sii ON sii.batch_id = b.id
      LEFT JOIN sale_invoices si ON si.id = sii.invoice_id ${dateFilter.replace(/AND /g, 'AND si.').replace('AND si.si.', 'AND si.')}
      WHERE p.active = 1
      GROUP BY p.id, p.name, p.unit
      ORDER BY net_profit DESC
    `);
    return res.json(profit);
  } catch (err) {
    console.error('Profit report error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

router.get('/inventory', async (req, res) => {
  try {
    const [inventory] = await query(`
      SELECT
        p.id as product_id,
        p.name as product_name,
        p.unit,
        p.min_stock,
        p.shelf_life_days,
        COALESCE(SUM(b.initial_qty), 0) as total_purchased,
        COALESCE(SUM(b.remaining_qty), 0) as total_remaining,
        COALESCE(SUM(b.sold_qty), 0) as total_sold,
        COALESCE(SUM(b.wasted_qty), 0) as total_wasted,
        (SELECT COUNT(*) FROM batches b2 WHERE b2.product_id = p.id AND b2.status = 'active') as active_batches,
        CASE
          WHEN COALESCE(SUM(b.initial_qty), 0) > 0
          THEN ROUND(COALESCE(SUM(b.wasted_qty), 0) / COALESCE(SUM(b.initial_qty), 0) * 100, 1)
          ELSE 0
        END as waste_pct,
        CASE
          WHEN COALESCE(SUM(b.remaining_qty), 0) <= p.min_stock THEN 'low'
          WHEN COALESCE(SUM(b.remaining_qty), 0) = 0 THEN 'empty'
          ELSE 'ok'
        END as stock_status
      FROM products p
      LEFT JOIN batches b ON b.product_id = p.id
      WHERE p.active = 1
      GROUP BY p.id, p.name, p.unit, p.min_stock, p.shelf_life_days
      ORDER BY p.name
    `);
    return res.json(inventory);
  } catch (err) {
    console.error('Inventory report error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

router.get('/batches-health', async (req, res) => {
  try {
    const [health] = await query(`
      SELECT
        b.id,
        b.batch_code,
        b.arrival_date,
        b.initial_qty,
        b.remaining_qty,
        b.sold_qty,
        b.wasted_qty,
        b.purchase_price,
        b.status,
        p.name as product_name,
        p.shelf_life_days,
        DATEDIFF(CURDATE(), b.arrival_date) as age_days,
        ROUND(DATEDIFF(CURDATE(), b.arrival_date) / p.shelf_life_days * 100, 1) as life_pct,
        CASE
          WHEN b.remaining_qty <= 0 THEN 'finished'
          WHEN b.status = 'expired' THEN 'expired'
          WHEN DATEDIFF(CURDATE(), b.arrival_date) >= p.shelf_life_days * 0.75 THEN 'danger'
          WHEN DATEDIFF(CURDATE(), b.arrival_date) >= p.shelf_life_days * 0.40 THEN 'warning'
          ELSE 'fresh'
        END as health
      FROM batches b
      JOIN products p ON b.product_id = p.id
      WHERE b.status = 'active' AND b.remaining_qty > 0
      ORDER BY age_days DESC
    `);
    return res.json(health);
  } catch (err) {
    console.error('Batches health error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

router.get('/low-stock', async (req, res) => {
  try {
    const [products] = await query(`
      SELECT
        p.id,
        p.name,
        p.unit,
        p.min_stock,
        COALESCE(SUM(b.remaining_qty), 0) as total_remaining
      FROM products p
      LEFT JOIN batches b ON b.product_id = p.id AND b.status = 'active'
      WHERE p.active = 1
      GROUP BY p.id, p.name, p.unit, p.min_stock
      HAVING total_remaining <= p.min_stock
      ORDER BY total_remaining ASC
    `);
    return res.json(products);
  } catch (err) {
    console.error('Low stock report error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

export default router;
