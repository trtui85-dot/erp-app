import { Router } from 'express';
import { query } from '../db.js';
import { requireModule } from '../auth.js';

const router = Router();

router.get('/', requireModule('customers'), async (req, res) => {
  try {
    const [customers] = await query('SELECT * FROM customers ORDER BY name');
    return res.json(customers);
  } catch (err) {
    console.error('List customers error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', requireModule('customers'), async (req, res) => {
  try {
    const [customers] = await query('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    if (customers.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    const [invoices] = await query(
      'SELECT * FROM sale_invoices WHERE customer_id = ? ORDER BY date DESC LIMIT 20',
      [req.params.id]
    );
    const [debts] = await query(
      'SELECT * FROM debts WHERE customer_id = ? ORDER BY created_date DESC',
      [req.params.id]
    );
    return res.json({ ...customers[0], invoices, debts });
  } catch (err) {
    console.error('Get customer error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', requireModule('customers'), async (req, res) => {
  try {
    const { name, phone, address } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    const [result] = await query(
      'INSERT INTO customers (name, phone, address) VALUES (?, ?, ?)',
      [name, phone || null, address || null]
    );
    const [customer] = await query('SELECT * FROM customers WHERE id = ?', [result.insertId]);
    return res.status(201).json(customer[0]);
  } catch (err) {
    console.error('Create customer error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/:id', requireModule('customers'), async (req, res) => {
  try {
    const { name, phone, address } = req.body;
    const [existing] = await query('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    await query(
      'UPDATE customers SET name = ?, phone = ?, address = ? WHERE id = ?',
      [
        name || existing[0].name,
        phone !== undefined ? phone : existing[0].phone,
        address !== undefined ? address : existing[0].address,
        req.params.id
      ]
    );
    const [customer] = await query('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    return res.json(customer[0]);
  } catch (err) {
    console.error('Update customer error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', requireModule('customers'), async (req, res) => {
  try {
    const [existing] = await query('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    await query('DELETE FROM customers WHERE id = ?', [req.params.id]);
    return res.json({ message: 'Customer deleted' });
  } catch (err) {
    console.error('Delete customer error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
