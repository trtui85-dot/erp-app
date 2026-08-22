import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool, { query } from '../db.js';
import { generateToken, authenticate } from '../auth.js';

const router = Router();

router.post('/login', async (req, res) => {
  try {
    const { phone, pin } = req.body;
    if (!phone || !pin) {
      return res.status(400).json({ error: 'Phone and pin are required' });
    }
    const [users] = await query('SELECT * FROM users WHERE phone = ? AND active = 1', [phone]);
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = users[0];
    const valid = await bcrypt.compare(pin, user.pin_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = generateToken(user);
    const { pin_hash, ...safeUser } = user;
    return res.json({ token, user: safeUser });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

router.post('/refresh', authenticate, async (req, res) => {
  try {
    const [users] = await query('SELECT * FROM users WHERE id = ? AND active = 1', [req.user.id]);
    if (users.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }
    const token = generateToken(users[0]);
    const { pin_hash, ...safeUser } = users[0];
    return res.json({ token, user: safeUser });
  } catch (err) {
    console.error('Refresh error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

router.post('/logout', authenticate, async (req, res) => {
  return res.json({ message: 'Logged out' });
});

export default router;
