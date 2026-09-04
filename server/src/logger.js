import { query } from './db.js';

export function getIp(req) {
  const fwd = req.headers?.['x-forwarded-for'];
  if (fwd && typeof fwd === 'string') return fwd.split(',')[0].trim();
  return (req.socket?.remoteAddress || req.ip || '').replace(/^::ffff:/, '');
}

export async function logAction({ userId = null, userName = null, userPhone = null, action, details = null, ip = null }) {
  try {
    await query(
      'INSERT INTO user_logs (user_id, user_name, user_phone, action, details, ip) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, userName, userPhone, String(action || '').slice(0, 150), details ? String(details).slice(0, 500) : null, ip || null]
    );
  } catch (err) {
    console.error('logAction error:', err.message);
  }
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function activityLogger(req, res, next) {
  const method = (req.method || '').toUpperCase();
  if (!MUTATING.has(method)) return next();
  const start = Date.now();
  res.on('finish', () => {
    const u = req.user || {};
    const path = (req.baseUrl || '') + (req.route?.path || req.path || '');
    logAction({
      userId: u.id ?? null,
      userName: u.name ?? null,
      userPhone: u.phone ?? null,
      action: `${method} ${path}`,
      details: `status=${res.statusCode}, ${Date.now() - start}ms`,
      ip: getIp(req),
    });
  });
  next();
}