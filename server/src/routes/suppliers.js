import { Router } from 'express';
import { query } from '../db.js';
import { requireModule } from '../auth.js';

const router = Router();

router.get('/', requireModule('suppliers'), async (req, res) => {
  try {
    const [suppliers] = await query('SELECT * FROM suppliers ORDER BY name');
    return res.json(suppliers);
  } catch (err) {
    console.error('List suppliers error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

router.get('/:id', requireModule('suppliers'), async (req, res) => {
  try {
    const [suppliers] = await query('SELECT * FROM suppliers WHERE id = ?', [req.params.id]);
    if (suppliers.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    const [invoices] = await query(
      'SELECT * FROM supply_invoices WHERE supplier_id = ? ORDER BY date DESC LIMIT 20',
      [req.params.id]
    );
    return res.json({ ...suppliers[0], invoices });
  } catch (err) {
    console.error('Get supplier error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

router.post('/', requireModule('suppliers'), async (req, res) => {
  try {
    const { name, phone, specialty, notes } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone are required' });
    }
    const [result] = await query(
      'INSERT INTO suppliers (name, phone, specialty, notes) VALUES (?, ?, ?, ?)',
      [name, phone, specialty || null, notes || null]
    );
    const [supplier] = await query('SELECT * FROM suppliers WHERE id = ?', [result.insertId]);
    return res.status(201).json(supplier[0]);
  } catch (err) {
    console.error('Create supplier error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

router.patch('/:id', requireModule('suppliers'), async (req, res) => {
  try {
    const { name, phone, specialty, notes } = req.body;
    const [existing] = await query('SELECT * FROM suppliers WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    await query(
      'UPDATE suppliers SET name = ?, phone = ?, specialty = ?, notes = ? WHERE id = ?',
      [
        name || existing[0].name,
        phone || existing[0].phone,
        specialty !== undefined ? specialty : existing[0].specialty,
        notes !== undefined ? notes : existing[0].notes,
        req.params.id
      ]
    );
    const [supplier] = await query('SELECT * FROM suppliers WHERE id = ?', [req.params.id]);
    return res.json(supplier[0]);
  } catch (err) {
    console.error('Update supplier error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

router.delete('/:id', requireModule('suppliers'), async (req, res) => {
  try {
    const [existing] = await query('SELECT * FROM suppliers WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    await query('DELETE FROM suppliers WHERE id = ?', [req.params.id]);
    return res.json({ message: 'Supplier deleted' });
  } catch (err) {
    console.error('Delete supplier error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

export default router;
