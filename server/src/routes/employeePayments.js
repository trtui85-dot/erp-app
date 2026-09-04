import { Router } from 'express';
import { query } from '../db.js';
import { requireModule } from '../auth.js';

const router = Router();
router.use(requireModule('employees'));

router.get('/', async (req, res) => {
  try {
    const { employee_id, month } = req.query;
    let sql = `SELECT ep.*, e.name AS employee_name, pm.name AS payment_method_name
      FROM employee_payments ep
      LEFT JOIN employees e ON e.id = ep.employee_id
      LEFT JOIN payment_methods pm ON pm.id = ep.payment_method_id WHERE 1=1`;
    const params = [];
    if (employee_id) { sql += ' AND ep.employee_id = ?'; params.push(employee_id); }
    if (month) { sql += ' AND MONTH(ep.created_at) = ? AND YEAR(ep.created_at) = ?'; const [y, m] = month.split('-'); params.push(m, y); }
    sql += ' ORDER BY ep.created_at DESC';
    const [rows] = await query(sql, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  const conn = await query.getConnection ? null : null;
  try {
    const { employee_id, amount, payment_method_id, period_from, period_to, notes } = req.body;
    if (!employee_id || !amount) return res.status(400).json({ error: 'employee_id and amount required' });

    const [result] = await query(
      'INSERT INTO employee_payments (employee_id, amount, payment_method_id, period_from, period_to, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [employee_id, amount, payment_method_id || null, period_from || null, period_to || null, notes || null]
    );

    if (payment_method_id && Number(amount) > 0) {
      await query(
        'INSERT INTO transactions (ref_type, ref_id, from_payment_method_id, amount, note) VALUES (?, ?, ?, ?, ?)',
        ['withdrawal', result.insertId, payment_method_id, amount, `رواتب - ${notes || ''}`]
      );
    }

    await query(
      "UPDATE employee_attendance SET status = 'paid' WHERE employee_id = ? AND status = 'pending'",
      [employee_id]
    );

    res.json({ id: result.insertId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM employee_payments WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
