import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const [y, m] = month.split('-');

    const [employees] = await query(
      "SELECT * FROM employees WHERE active = 1 ORDER BY name"
    );

    const results = [];
    for (const emp of employees) {
      let totalDue = 0;
      let totalPaid = 0;

      if (emp.salary_type === 'monthly') {
        totalDue = emp.salary_amount;
        const [paid] = await query(
          "SELECT COALESCE(SUM(amount),0) AS total FROM employee_payments WHERE employee_id = ? AND MONTH(created_at) = ? AND YEAR(created_at) = ?",
          [emp.id, m, y]
        );
        totalPaid = paid[0].total;
      } else {
        const [att] = await query(
          "SELECT COALESCE(SUM(amount),0) AS total FROM employee_attendance WHERE employee_id = ? AND MONTH(date) = ? AND YEAR(date) = ?",
          [emp.id, m, y]
        );
        totalDue = att[0].total;
        const [paid] = await query(
          "SELECT COALESCE(SUM(amount),0) AS total FROM employee_payments WHERE employee_id = ? AND MONTH(created_at) = ? AND YEAR(created_at) = ? AND period_from <= ? AND period_to >= ?",
          [emp.id, m, y, `${y}-${m}-01`, `${y}-${m}-31`]
        );
        totalPaid = paid[0].total;
      }

      const [advances] = await query(
        "SELECT COALESCE(SUM(amount),0) AS total FROM employee_advances WHERE employee_id = ? AND status = 'active'",
        [emp.id]
      );
      const activeAdvances = advances[0].total;

      results.push({
        ...emp,
        totalDue,
        totalPaid,
        balance: totalDue - totalPaid,
        activeAdvances,
        netPaid: totalPaid - activeAdvances,
      });
    }

    const totalAll = results.reduce((s, e) => s + e.totalDue, 0);
    const paidAll = results.reduce((s, e) => s + e.totalPaid, 0);

    res.json({ month, employees: results, totalDue: totalAll, totalPaid: paidAll });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
