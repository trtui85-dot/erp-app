import { Router } from 'express';
import { query } from '../db.js';
import { requireAdmin } from '../auth.js';

const router = Router();

router.get('/', requireAdmin, async (req, res) => {
  try {
    const [settings] = await query('SELECT * FROM settings');
    const settingsObj = {};
    for (const s of settings) {
      settingsObj[s.setting_key] = s.setting_value;
    }
    return res.json(settingsObj);
  } catch (err) {
    console.error('Get settings error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

router.patch('/', requireAdmin, async (req, res) => {
  try {
    const updates = req.body;
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ error: 'Settings object is required' });
    }

    for (const [key, value] of Object.entries(updates)) {
      const [existing] = await query('SELECT * FROM settings WHERE setting_key = ?', [key]);
      if (existing.length > 0) {
        await query('UPDATE settings SET setting_value = ? WHERE setting_key = ?', [String(value), key]);
      } else {
        await query('INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)', [key, String(value)]);
      }
    }

    const [settings] = await query('SELECT * FROM settings');
    const settingsObj = {};
    for (const s of settings) {
      settingsObj[s.setting_key] = s.setting_value;
    }
    return res.json(settingsObj);
  } catch (err) {
    console.error('Update settings error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

export default router;
