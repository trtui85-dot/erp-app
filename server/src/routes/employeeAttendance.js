import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { date, employee_id, month } = req.query;
    let sql = `SELECT ea.*, e.name AS employee_name, e.salary_type, e.salary_amount, e.role AS employee_role
      FROM employee_attendance ea
      LEFT JOIN employees e ON e.id = ea.employee_id WHERE 1=1`;
    const params = [];
    if (date) { sql += ' AND ea.date = ?'; params.push(date); }
    if (employee_id) { sql += ' AND ea.employee_id = ?'; params.push(employee_id); }
    if (month) { sql += ' AND MONTH(ea.date) = ? AND YEAR(ea.date) = ?'; const [y, m] = month.split('-'); params.push(m, y); }
    sql += ' ORDER BY ea.date DESC, ea.id DESC';
    const [rows] = await query(sql, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { employee_id, date, work_type, supply_invoice_id, amount, notes } = req.body;
    const [result] = await query(
      'INSERT INTO employee_attendance (employee_id, date, work_type, supply_invoice_id, amount, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [employee_id, date || new Date().toISOString().split('T')[0], work_type || 'daily', supply_invoice_id || null, amount || 0, notes || null]
    );
    res.json({ id: result.insertId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id', async (req, res) => {
  try {
    const { work_type, amount, status, notes, date, supply_invoice_id } = req.body;
    const fields = [];
    const vals = [];
    if (work_type !== undefined) { fields.push('work_type=?'); vals.push(work_type); }
    if (amount !== undefined) { fields.push('amount=?'); vals.push(amount); }
    if (status !== undefined) { fields.push('status=?'); vals.push(status); }
    if (notes !== undefined) { fields.push('notes=?'); vals.push(notes); }
    if (date !== undefined) { fields.push('date=?'); vals.push(date); }
    if (supply_invoice_id !== undefined) { fields.push('supply_invoice_id=?'); vals.push(supply_invoice_id); }
    if (fields.length > 0) {
      vals.push(req.params.id);
      await query(`UPDATE employee_attendance SET ${fields.join(', ')} WHERE id=?`, vals);
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM employee_attendance WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
