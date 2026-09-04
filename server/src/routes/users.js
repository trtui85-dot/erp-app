import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { requireAdmin } from '../auth.js';
import { getIp } from '../logger.js';

const router = Router();

router.use(requireAdmin);

function normalizePerms(perms) {
  if (!perms) return {};
  if (typeof perms === 'string') {
    try { return JSON.parse(perms); } catch { return {}; }
  }
  return perms;
}

router.get('/', async (req, res) => {
  try {
    const [users] = await query(`
      SELECT id, name, phone, role, worker_id, permissions, see_stats, active
      FROM users ORDER BY role = 'ADMIN' DESC, id ASC
    `);
    const clean = users.map((u) => ({ ...u, permissions: normalizePerms(u.permissions) }));
    return res.json(clean);
  } catch (err) {
    console.error('List users error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, phone, pin, role, permissions, see_stats, worker_id } = req.body;
    if (!name || !phone || !pin) {
      return res.status(400).json({ error: 'Name, phone and pin are required' });
    }
    const dup = await query('SELECT id FROM users WHERE phone = ?', [phone]);
    if (dup[0].length > 0) {
      return res.status(409).json({ error: 'Phone number already used' });
    }
    const hash = await bcrypt.hash(String(pin), 10);
    const [result] = await query(
      'INSERT INTO users (name, phone, pin_hash, role, permissions, see_stats, worker_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, phone, hash, role === 'ADMIN' ? 'ADMIN' : 'WORKER', JSON.stringify(normalizePerms(permissions)), see_stats === false || see_stats === 0 ? 0 : 1, worker_id || null]
    );
    const [row] = await query('SELECT id, name, phone, role, worker_id, permissions, see_stats, active FROM users WHERE id = ?', [result.insertId]);
    return res.status(201).json(row[0]);
  } catch (err) {
    console.error('Create user error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { name, phone, pin, role, permissions, see_stats, worker_id, active } = req.body;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

    if (id === req.user.id && role === 'WORKER') {
      return res.status(400).json({ error: 'Cannot demote yourself' });
    }

    const set = [];
    const vals = [];
    if (name !== undefined) { set.push('name=?'); vals.push(name); }
    if (phone !== undefined) { set.push('phone=?'); vals.push(phone); }
    if (role !== undefined) { set.push('role=?'); vals.push(role === 'ADMIN' ? 'ADMIN' : 'WORKER'); }
    if (permissions !== undefined) { set.push('permissions=?'); vals.push(JSON.stringify(normalizePerms(permissions))); }
    if (see_stats !== undefined) { set.push('see_stats=?'); vals.push(see_stats === true || see_stats === 1 ? 1 : 0); }
    if (worker_id !== undefined) { set.push('worker_id=?'); vals.push(worker_id || null); }
    if (active !== undefined) { set.push('active=?'); vals.push(active === false || active === 0 ? 0 : 1); }
    if (pin) {
      const hash = await bcrypt.hash(String(pin), 10);
      set.push('pin_hash=?');
      vals.push(hash);
    }
    if (set.length === 0) return res.status(400).json({ error: 'Nothing to update' });

    if (phone !== undefined) {
      const dup = await query('SELECT id FROM users WHERE phone = ? AND id != ?', [phone, id]);
      if (dup[0].length > 0) return res.status(409).json({ error: 'Phone number already used' });
    }

    vals.push(id);
    await query(`UPDATE users SET ${set.join(', ')} WHERE id = ?`, vals);
    const [row] = await query('SELECT id, name, phone, role, worker_id, permissions, see_stats, active FROM users WHERE id = ?', [id]);
    return res.json(row[0]);
  } catch (err) {
    console.error('Update user error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
    if (id === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });

    const [row] = await query('SELECT role FROM users WHERE id = ?', [id]);
    if (row[0]?.role === 'ADMIN') {
      return res.status(400).json({ error: 'Cannot delete an admin account' });
    }
    await query('UPDATE users SET active = 0 WHERE id = ?', [id]);
    return res.json({ message: 'User deactivated' });
  } catch (err) {
    console.error('Delete user error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

router.get('/logs', async (req, res) => {
  try {
    const { user_id, action, limit, from_date, to_date } = req.query;
    const params = [];
    let where = '';
    if (user_id) { where += ` AND user_id = ?`; params.push(Number(user_id)); }
    if (action) { where += ` AND action ILIKE ?`; params.push(`%${String(action)}%`); }
    if (from_date) { where += ' AND created_at >= ?'; params.push(`${from_date} 00:00:00`); }
    if (to_date) { where += ' AND created_at <= ?'; params.push(`${to_date} 23:59:59`); }
    const lim = Math.min(Math.max(Number(limit) || 300, 1), 1000);
    params.push(lim);

    const [logs] = await query(`
      SELECT id, user_id, user_name, user_phone, action, details, ip, created_at
      FROM user_logs WHERE 1=1 ${where}
      ORDER BY created_at DESC LIMIT ?
    `, params);
    return res.json(logs);
  } catch (err) {
    console.error('Logs error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

router.get('/me', async (req, res) => {
  try {
    const [rows] = await query('SELECT id, name, phone, role, worker_id, permissions, see_stats, active FROM users WHERE id = ?', [req.user.id]);
    const u = rows[0];
    if (u) u.permissions = normalizePerms(u.permissions);
    return res.json(u || null);
  } catch (err) {
    console.error('Me error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

export default router;