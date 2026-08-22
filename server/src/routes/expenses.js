import { Router } from 'express';
import { query } from '../db.js';
import { requireModule } from '../auth.js';

const router = Router();

router.get('/', requireModule('expenses'), async (req, res) => {
  try {
    const [expenses] = await query('SELECT * FROM expenses ORDER BY date DESC');
    return res.json(expenses);
  } catch (err) {
    console.error('List expenses error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

router.get('/:id', requireModule('expenses'), async (req, res) => {
  try {
    const [expenses] = await query('SELECT * FROM expenses WHERE id = ?', [req.params.id]);
    if (expenses.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    return res.json(expenses[0]);
  } catch (err) {
    console.error('Get expense error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

router.post('/', requireModule('expenses'), async (req, res) => {
  try {
    const { category, amount, date, notes } = req.body;
    if (!category || !amount) {
      return res.status(400).json({ error: 'Category and amount are required' });
    }
    const expenseDate = date || new Date().toISOString().split('T')[0];
    const [result] = await query(
      'INSERT INTO expenses (category, amount, date, notes, created_by) VALUES (?, ?, ?, ?, ?)',
      [category, amount, expenseDate, notes || null, req.user.id]
    );
    const [expense] = await query('SELECT * FROM expenses WHERE id = ?', [result.insertId]);
    return res.status(201).json(expense[0]);
  } catch (err) {
    console.error('Create expense error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

router.patch('/:id', requireModule('expenses'), async (req, res) => {
  try {
    const { category, amount, date, notes } = req.body;
    const [existing] = await query('SELECT * FROM expenses WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    await query(
      'UPDATE expenses SET category = ?, amount = ?, date = ?, notes = ? WHERE id = ?',
      [
        category || existing[0].category,
        amount !== undefined ? amount : existing[0].amount,
        date || existing[0].date,
        notes !== undefined ? notes : existing[0].notes,
        req.params.id
      ]
    );
    const [expense] = await query('SELECT * FROM expenses WHERE id = ?', [req.params.id]);
    return res.json(expense[0]);
  } catch (err) {
    console.error('Update expense error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

router.delete('/:id', requireModule('expenses'), async (req, res) => {
  try {
    const [existing] = await query('SELECT * FROM expenses WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    await query('DELETE FROM expenses WHERE id = ?', [req.params.id]);
    return res.json({ message: 'Expense deleted' });
  } catch (err) {
    console.error('Delete expense error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

export default router;
