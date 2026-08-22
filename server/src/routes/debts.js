import { Router } from 'express';
import { query } from '../db.js';
import { requireModule } from '../auth.js';

const router = Router();

router.get('/', requireModule('debts'), async (req, res) => {
  try {
    let sql = `
      SELECT d.*, c.name as customer_name, c.phone as customer_phone
      FROM debts d
      JOIN customers c ON d.customer_id = c.id
    `;
    const params = [];
    if (req.query.status) {
      sql += ' WHERE d.status = ?';
      params.push(req.query.status);
    }
    sql += ' ORDER BY d.created_date DESC';
    const [debts] = await query(sql, params);
    return res.json(debts);
  } catch (err) {
    console.error('List debts error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

router.patch('/:id', requireModule('debts'), async (req, res) => {
  try {
    const { amount, status, notes } = req.body;
    const [existing] = await query('SELECT * FROM debts WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Debt not found' });
    }
    await query(
      'UPDATE debts SET amount = ?, status = ?, notes = ? WHERE id = ?',
      [
        amount !== undefined ? amount : existing[0].amount,
        status || existing[0].status,
        notes !== undefined ? notes : existing[0].notes,
        req.params.id
      ]
    );
    const [debt] = await query('SELECT * FROM debts WHERE id = ?', [req.params.id]);
    return res.json(debt[0]);
  } catch (err) {
    console.error('Update debt error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

router.post('/:id/pay', requireModule('debts'), async (req, res) => {
  try {
    const { amount, date, notes } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }
    const [existing] = await query('SELECT * FROM debts WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Debt not found' });
    }
    const debt = existing[0];
    const paymentDate = date || new Date().toISOString().split('T')[0];

    const [paymentResult] = await query(
      'INSERT INTO debt_payments (debt_id, amount, date, notes) VALUES (?, ?, ?, ?)',
      [req.params.id, amount, paymentDate, notes || null]
    );

    const newPaid = parseFloat(debt.paid) + parseFloat(amount);
    let newStatus = 'partial';
    if (newPaid >= parseFloat(debt.amount)) {
      newStatus = 'paid';
    }

    await query(
      'UPDATE debts SET paid = ?, status = ? WHERE id = ?',
      [newPaid, newStatus, req.params.id]
    );

    const [updatedDebt] = await query('SELECT * FROM debts WHERE id = ?', [req.params.id]);
    return res.status(201).json({ debt: updatedDebt[0], payment_id: paymentResult.insertId });
  } catch (err) {
    console.error('Pay debt error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

export default router;
