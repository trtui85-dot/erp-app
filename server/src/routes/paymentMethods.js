import { Router } from 'express';
import { query } from '../db.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `pm-${Date.now()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 } });

const router = Router();

router.get('/', async (req, res) => {
  try {
    const [methods] = await query(`
      SELECT pm.*,
        COALESCE((SELECT SUM(CASE
          WHEN ref_type IN ('deposit','sale') AND to_payment_method_id = pm.id THEN amount
          WHEN ref_type IN ('withdrawal','purchase') AND from_payment_method_id = pm.id THEN -amount
          WHEN ref_type = 'transfer' AND to_payment_method_id = pm.id THEN amount
          WHEN ref_type = 'transfer' AND from_payment_method_id = pm.id THEN -amount
          ELSE 0 END) FROM transactions), 0) AS balance
      FROM payment_methods pm
      WHERE pm.active = 1
      ORDER BY pm.type, pm.id
    `);
    res.json(methods);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/all', async (req, res) => {
  try {
    const [methods] = await query(`
      SELECT pm.*,
        COALESCE((SELECT SUM(CASE
          WHEN ref_type IN ('deposit','sale') AND to_payment_method_id = pm.id THEN amount
          WHEN ref_type IN ('withdrawal','purchase') AND from_payment_method_id = pm.id THEN -amount
          WHEN ref_type = 'transfer' AND to_payment_method_id = pm.id THEN amount
          WHEN ref_type = 'transfer' AND from_payment_method_id = pm.id THEN -amount
          ELSE 0 END) FROM transactions), 0) AS balance
      FROM payment_methods pm
      ORDER BY pm.type, pm.id
    `);
    res.json(methods);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', upload.single('logo'), async (req, res) => {
  try {
    const { name, type, account_number, icon, color } = req.body;
    const logo_url = req.file ? `/uploads/${req.file.filename}` : null;
    const count = (await query('SELECT COUNT(*) AS c FROM payment_methods'))[0][0].c;
    const code = `PM-${String(count + 1).padStart(3, '0')}`;
    const [result] = await query(
      'INSERT INTO payment_methods (code, name, type, account_number, icon, color, logo_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [code, name, type || 'cash', account_number || null, icon || 'CreditCard', color || '#6b7280', logo_url]
    );
    res.json({ id: result.insertId, code, logo_url });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id', upload.single('logo'), async (req, res) => {
  try {
    const { name, type, account_number, icon, color, active } = req.body;
    const logo_url = req.file ? `/uploads/${req.file.filename}` : (req.body.logo_url || null);
    const fields = [];
    const vals = [];
    if (name !== undefined) { fields.push('name=?'); vals.push(name); }
    if (type !== undefined) { fields.push('type=?'); vals.push(type); }
    if (account_number !== undefined) { fields.push('account_number=?'); vals.push(account_number); }
    if (icon !== undefined) { fields.push('icon=?'); vals.push(icon); }
    if (color !== undefined) { fields.push('color=?'); vals.push(color); }
    if (active !== undefined) { fields.push('active=?'); vals.push(active); }
    if (logo_url !== null) { fields.push('logo_url=?'); vals.push(logo_url); }
    if (fields.length > 0) {
      vals.push(req.params.id);
      await query(`UPDATE payment_methods SET ${fields.join(', ')} WHERE id=?`, vals);
    }
    res.json({ ok: true, logo_url });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/transactions', async (req, res) => {
  try {
    const { payment_method_id, type, from, to } = req.query;
    let sql = `
      SELECT t.*,
        pm_from.name AS from_name, pm_from.icon AS from_icon, pm_from.color AS from_color,
        pm_to.name AS to_name, pm_to.icon AS to_icon, pm_to.color AS to_color,
        u.name AS user_name
      FROM transactions t
      LEFT JOIN payment_methods pm_from ON t.from_payment_method_id = pm_from.id
      LEFT JOIN payment_methods pm_to ON t.to_payment_method_id = pm_to.id
      LEFT JOIN users u ON t.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    if (payment_method_id) { sql += ' AND (t.from_payment_method_id = ? OR t.to_payment_method_id = ?)'; params.push(payment_method_id, payment_method_id); }
    if (type) { sql += ' AND t.ref_type = ?'; params.push(type); }
    if (from) { sql += ' AND DATE(t.created_at) >= ?'; params.push(from); }
    if (to) { sql += ' AND DATE(t.created_at) <= ?'; params.push(to); }
    sql += ' ORDER BY t.created_at DESC LIMIT 200';
    const [rows] = await query(sql, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/deposit', async (req, res) => {
  try {
    const { payment_method_id, amount, note, created_by } = req.body;
    if (!payment_method_id || !amount || amount <= 0) return res.status(400).json({ error: 'Invalid' });

    const [balance] = await query(`
      SELECT COALESCE(SUM(CASE
        WHEN ref_type IN ('deposit','sale') AND to_payment_method_id = ? THEN amount
        WHEN ref_type IN ('withdrawal','purchase') AND from_payment_method_id = ? THEN -amount
        WHEN ref_type = 'transfer' AND to_payment_method_id = ? THEN amount
        WHEN ref_type = 'transfer' AND from_payment_method_id = ? THEN -amount
        ELSE 0 END), 0) AS bal FROM transactions
    `, [payment_method_id, payment_method_id, payment_method_id, payment_method_id]);
    const newBalance = Number(balance[0].bal) + Number(amount);

    await query(
      'INSERT INTO transactions (ref_type, to_payment_method_id, amount, balance_after, note, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      ['deposit', payment_method_id, amount, newBalance, note || null, created_by || null]
    );
    res.json({ balance: newBalance });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/withdrawal', async (req, res) => {
  try {
    const { payment_method_id, amount, note, created_by } = req.body;
    if (!payment_method_id || !amount || amount <= 0) return res.status(400).json({ error: 'Invalid' });

    const [balance] = await query(`
      SELECT COALESCE(SUM(CASE
        WHEN ref_type IN ('deposit','sale') AND to_payment_method_id = ? THEN amount
        WHEN ref_type IN ('withdrawal','purchase') AND from_payment_method_id = ? THEN -amount
        WHEN ref_type = 'transfer' AND to_payment_method_id = ? THEN amount
        WHEN ref_type = 'transfer' AND from_payment_method_id = ? THEN -amount
        ELSE 0 END), 0) AS bal FROM transactions
    `, [payment_method_id, payment_method_id, payment_method_id, payment_method_id]);
    const currentBal = Number(balance[0].bal);
    if (currentBal < amount) return res.status(400).json({ error: 'Insufficient balance' });

    const newBalance = currentBal - Number(amount);
    await query(
      'INSERT INTO transactions (ref_type, from_payment_method_id, amount, balance_after, note, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      ['withdrawal', payment_method_id, amount, newBalance, note || null, created_by || null]
    );
    res.json({ balance: newBalance });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/transfer', async (req, res) => {
  try {
    const { from_payment_method_id, to_payment_method_id, amount, note, created_by } = req.body;
    if (!from_payment_method_id || !to_payment_method_id || !amount || amount <= 0) return res.status(400).json({ error: 'Invalid' });
    if (from_payment_method_id === to_payment_method_id) return res.status(400).json({ error: 'Same method' });

    const [balFrom] = await query(`
      SELECT COALESCE(SUM(CASE
        WHEN ref_type IN ('deposit','sale') AND to_payment_method_id = ? THEN amount
        WHEN ref_type IN ('withdrawal','purchase') AND from_payment_method_id = ? THEN -amount
        WHEN ref_type = 'transfer' AND to_payment_method_id = ? THEN amount
        WHEN ref_type = 'transfer' AND from_payment_method_id = ? THEN -amount
        ELSE 0 END), 0) AS bal FROM transactions
    `, [from_payment_method_id, from_payment_method_id, from_payment_method_id, from_payment_method_id]);
    if (Number(balFrom[0].bal) < amount) return res.status(400).json({ error: 'Insufficient balance' });

    const [balTo] = await query(`
      SELECT COALESCE(SUM(CASE
        WHEN ref_type IN ('deposit','sale') AND to_payment_method_id = ? THEN amount
        WHEN ref_type IN ('withdrawal','purchase') AND from_payment_method_id = ? THEN -amount
        WHEN ref_type = 'transfer' AND to_payment_method_id = ? THEN amount
        WHEN ref_type = 'transfer' AND from_payment_method_id = ? THEN -amount
        ELSE 0 END), 0) AS bal FROM transactions
    `, [to_payment_method_id, to_payment_method_id, to_payment_method_id, to_payment_method_id]);

    const newFromBal = Number(balFrom[0].bal) - Number(amount);
    const newToBal = Number(balTo[0].bal) + Number(amount);

    await query(
      'INSERT INTO transactions (ref_type, from_payment_method_id, to_payment_method_id, amount, balance_after, note, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['transfer', from_payment_method_id, to_payment_method_id, amount, newToBal, note || null, created_by || null]
    );
    await query(
      'INSERT INTO transactions (ref_type, from_payment_method_id, to_payment_method_id, amount, balance_after, note, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['transfer', from_payment_method_id, to_payment_method_id, amount, newFromBal, note || null, created_by || null]
    );
    res.json({ from_balance: newFromBal, to_balance: newToBal });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
