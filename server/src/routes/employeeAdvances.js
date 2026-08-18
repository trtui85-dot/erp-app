import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { employee_id } = req.query;
    let sql = `SELECT ea.*, e.name AS employee_name
      FROM employee_advances ea
      LEFT JOIN employees e ON e.id = ea.employee_id WHERE 1=1`;
    const params = [];
    if (employee_id) { sql += ' AND ea.employee_id = ?'; params.push(employee_id); }
    sql += ' ORDER BY ea.created_at DESC';
    const [rows] = await query(sql, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/active', async (req, res) => {
  try {
    const { employee_id } = req.query;
    let sql = `SELECT ea.*, e.name AS employee_name
      FROM employee_advances ea
      LEFT JOIN employees e ON e.id = ea.employee_id
      WHERE ea.status = 'active'`;
    const params = [];
    if (employee_id) { sql += ' AND ea.employee_id = ?'; params.push(employee_id); }
    sql += ' ORDER BY ea.date DESC';
    const [rows] = await query(sql, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { employee_id, amount, date, notes } = req.body;
    const [result] = await query(
      'INSERT INTO employee_advances (employee_id, amount, date, notes) VALUES (?, ?, ?, ?)',
      [employee_id, amount, date || new Date().toISOString().split('T')[0], notes || null]
    );
    res.json({ id: result.insertId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id/deduct', async (req, res) => {
  try {
    const { payment_id } = req.body;
    await query(
      "UPDATE employee_advances SET status = 'deducted', deducted_in_payment_id = ? WHERE id = ?",
      [payment_id || null, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
