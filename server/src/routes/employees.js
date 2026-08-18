import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const [rows] = await query('SELECT * FROM employees ORDER BY active DESC, name ASC');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const [rows] = await query('SELECT * FROM employees WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, phone, role, salary_type, salary_amount, hire_date, notes } = req.body;
    const [result] = await query(
      'INSERT INTO employees (name, phone, role, salary_type, salary_amount, hire_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, phone || null, role || 'worker', salary_type || 'daily', salary_amount || 0, hire_date || null, notes || null]
    );
    res.json({ id: result.insertId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id', async (req, res) => {
  try {
    const { name, phone, role, salary_type, salary_amount, hire_date, active, notes } = req.body;
    const fields = [];
    const vals = [];
    if (name !== undefined) { fields.push('name=?'); vals.push(name); }
    if (phone !== undefined) { fields.push('phone=?'); vals.push(phone); }
    if (role !== undefined) { fields.push('role=?'); vals.push(role); }
    if (salary_type !== undefined) { fields.push('salary_type=?'); vals.push(salary_type); }
    if (salary_amount !== undefined) { fields.push('salary_amount=?'); vals.push(salary_amount); }
    if (hire_date !== undefined) { fields.push('hire_date=?'); vals.push(hire_date); }
    if (active !== undefined) { fields.push('active=?'); vals.push(active); }
    if (notes !== undefined) { fields.push('notes=?'); vals.push(notes); }
    if (fields.length > 0) {
      vals.push(req.params.id);
      await query(`UPDATE employees SET ${fields.join(', ')} WHERE id=?`, vals);
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM employees WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
