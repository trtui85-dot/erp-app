import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

router.get('/stats', async (req, res) => {
  try {
    const [productCount] = await query('SELECT COUNT(*) as count FROM products WHERE active = 1');
    const [batchCount] = await query('SELECT COUNT(*) as count FROM batches WHERE status = ?', ['active']);
    const [lowStockResult] = await query(`
      SELECT COUNT(*) as count FROM (
        SELECT p.id
        FROM products p
        LEFT JOIN batches b ON b.product_id = p.id AND b.status = 'active'
        WHERE p.active = 1
        GROUP BY p.id
        HAVING COALESCE(SUM(b.remaining_qty), 0) <= MIN(p.min_stock)
      ) t
    `);
    const [pendingDebts] = await query("SELECT COUNT(*) as count, COALESCE(SUM(amount - paid), 0) as total FROM debts WHERE status IN ('pending', 'partial')");
    const [todaySales] = await query(
      'SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total FROM sale_invoices WHERE date = CURRENT_DATE'
    );
    const [weekSupplies] = await query(
      "SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total FROM supply_invoices WHERE date >= CURRENT_DATE - INTERVAL '7 days'"
    );
    const [totalWaste] = await query(
      "SELECT COUNT(*) as count, COALESCE(SUM(loss_value), 0) as total FROM waste_records"
    );
    const [todayWaste] = await query(
      "SELECT COUNT(*) as count, COALESCE(SUM(loss_value), 0) as total FROM waste_records WHERE date = CURRENT_DATE"
    );

    const [lowStockRows] = await query(`
      SELECT p.id, p.name, p.min_stock,
        COALESCE(SUM(b.remaining_qty), 0) as total_remaining
      FROM products p
      LEFT JOIN batches b ON b.product_id = p.id AND b.status = 'active'
      WHERE p.active = 1
      GROUP BY p.id, p.name, p.min_stock
      HAVING total_remaining <= p.min_stock
      ORDER BY total_remaining ASC
    `);

    const [dangerBatches] = await query(`
      SELECT b.id, b.batch_code, p.name as product_name, b.remaining_qty,
        (CURRENT_DATE - b.arrival_date)::int as age_days, p.shelf_life_days
      FROM batches b
      JOIN products p ON b.product_id = p.id
      WHERE b.status = 'active' AND b.remaining_qty > 0
        AND (CURRENT_DATE - b.arrival_date)::int >= p.shelf_life_days * 0.75
      ORDER BY age_days DESC
      LIMIT 5
    `);

    return res.json({
      total_products: productCount[0].count,
      total_batches: batchCount[0].count,
      low_stock_count: lowStockResult[0]?.count || 0,
      low_stock_products: Array.isArray(lowStockRows) ? lowStockRows : [],
      pending_debts_count: pendingDebts[0].count,
      pending_debts_total: parseFloat(pendingDebts[0].total),
      today_sales_count: todaySales[0].count,
      today_sales_total: parseFloat(todaySales[0].total),
      week_supplies_count: weekSupplies[0].count,
      week_supplies_total: parseFloat(weekSupplies[0].total),
      total_waste_count: totalWaste[0].count,
      total_waste_loss: parseFloat(totalWaste[0].total),
      today_waste_count: todayWaste[0].count,
      today_waste_loss: parseFloat(todayWaste[0].total),
      danger_batches: dangerBatches || []
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

router.get('/recent', async (req, res) => {
  try {
    const [recentSales] = await query(`
      SELECT si.id, si.date, si.total, c.name as customer_name, 'sale' as type
      FROM sale_invoices si
      LEFT JOIN customers c ON si.customer_id = c.id
      ORDER BY si.date DESC LIMIT 5
    `);

    const [recentSupplies] = await query(`
      SELECT si.id, si.date, si.total, s.name as supplier_name, 'supply' as type
      FROM supply_invoices si
      JOIN suppliers s ON si.supplier_id = s.id
      ORDER BY si.date DESC LIMIT 5
    `);

    const [recentDebts] = await query(`
      SELECT d.id, d.created_date as date, d.amount, c.name as customer_name, 'debt' as type, d.status
      FROM debts d
      JOIN customers c ON d.customer_id = c.id
      ORDER BY d.created_date DESC LIMIT 5
    `);

    const [recentWaste] = await query(`
      SELECT w.id, w.date, w.loss_value as total, p.name as product_name, 'waste' as type
      FROM waste_records w
      JOIN products p ON w.product_id = p.id
      ORDER BY w.date DESC LIMIT 5
    `);

    const all = [
      ...recentSales.map(r => ({ ...r, category: 'sale' })),
      ...recentSupplies.map(r => ({ ...r, category: 'supply' })),
      ...recentDebts.map(r => ({ ...r, category: 'debt' })),
      ...recentWaste.map(r => ({ ...r, category: 'waste' }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 15);

    return res.json(all);
  } catch (err) {
    console.error('Dashboard recent error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

export default router;
