import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];

    const [saleInvoices] = await query(`
      SELECT si.*, c.name AS customer_name, pm.name AS payment_method_name, pm.icon AS payment_method_icon, pm.color AS payment_method_color
      FROM sale_invoices si
      LEFT JOIN customers c ON c.id = si.customer_id
      LEFT JOIN payment_methods pm ON pm.id = si.payment_method_id
      WHERE si.date = ?
      ORDER BY si.id ASC
    `, [date]);

    let invoiceItems = [];
    if (saleInvoices.length > 0) {
      const ids = saleInvoices.map((i) => i.id);
      [invoiceItems] = await query(`
        SELECT sii.*, p.name AS product_name, b.batch_code, b.purchase_price
        FROM sale_invoice_items sii
        LEFT JOIN batches b ON b.id = sii.batch_id
        LEFT JOIN products p ON p.id = b.product_id
        WHERE sii.invoice_id IN (?)
      `, [ids]);
    }
    for (const inv of saleInvoices) {
      inv.items = invoiceItems.filter((it) => it.invoice_id === inv.id);
    }

    const totalSales = saleInvoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0);
    const totalPaid = saleInvoices.reduce((sum, inv) => sum + Number(inv.paid || 0), 0);
    const unpaidSales = totalSales - totalPaid;

    const salesByMethod = {};
    for (const inv of saleInvoices) {
      const mName = inv.payment_method_name || "—";
      if (!salesByMethod[mName]) salesByMethod[mName] = { name: mName, icon: inv.payment_method_icon, color: inv.payment_method_color, total: 0, count: 0 };
      salesByMethod[mName].total += Number(inv.total || 0);
      salesByMethod[mName].count++;
    }

    const [expenses] = await query(`SELECT * FROM expenses WHERE date = ? ORDER BY id ASC`, [date]);
    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

    const [waste] = await query(`
      SELECT w.*, p.name AS product_name, b.batch_code, b.unit
      FROM waste_records w
      LEFT JOIN products p ON p.id = w.product_id
      LEFT JOIN batches b ON b.id = w.batch_id
      WHERE w.date = ?
      ORDER BY w.id ASC
    `, [date]);
    const totalWasteValue = waste.reduce((sum, w) => sum + Number(w.loss_value || 0), 0);

    const [supplies] = await query(`
      SELECT si.*, s.name AS supplier_name
      FROM supply_invoices si
      LEFT JOIN suppliers s ON s.id = si.supplier_id
      WHERE si.date = ?
      ORDER BY si.id ASC
    `, [date]);
    const totalSupplies = supplies.reduce((sum, s) => sum + Number(s.total || 0), 0);

    const [debtPayments] = await query(`
      SELECT dp.*, c.name AS customer_name, d.id AS debt_id
      FROM debt_payments dp
      LEFT JOIN debts d ON d.id = dp.debt_id
      LEFT JOIN customers c ON c.id = d.customer_id
      WHERE dp.date = ?
      ORDER BY dp.id ASC
    `, [date]);
    const totalDebtPayments = debtPayments.reduce((sum, dp) => sum + Number(dp.amount || 0), 0);

    const [transfers] = await query(`
      SELECT t.*, pm_from.name AS from_name, pm_to.name AS to_name
      FROM transactions t
      LEFT JOIN payment_methods pm_from ON pm_from.id = t.from_payment_method_id
      LEFT JOIN payment_methods pm_to ON pm_to.id = t.to_payment_method_id
      WHERE DATE(t.created_at) = ? AND t.ref_type = 'transfer'
      ORDER BY t.id ASC
    `, [date]);

    const netDay = totalPaid - totalExpenses - totalWasteValue;

    res.json({
      date,
      sales: {
        invoices: saleInvoices,
        total: totalSales,
        paid: totalPaid,
        unpaid: unpaidSales,
        count: saleInvoices.length,
        byMethod: Object.values(salesByMethod),
      },
      expenses: {
        items: expenses,
        total: totalExpenses,
        count: expenses.length,
      },
      waste: {
        items: waste,
        totalValue: totalWasteValue,
        totalQty: waste.reduce((sum, w) => sum + Number(w.qty || 0), 0),
      },
      supplies: {
        invoices: supplies,
        total: totalSupplies,
        count: supplies.length,
      },
      debtPayments: {
        items: debtPayments,
        total: totalDebtPayments,
      },
      transfers,
      net: netDay,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
