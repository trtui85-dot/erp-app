import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'erp-secret-key-2024';

export function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      phone: user.phone,
      role: user.role,
      name: user.name,
      see_stats: user.see_stats,
      permissions: user.permissions || {},
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

export function parsePerms(perms) {
  if (!perms) return {};
  if (typeof perms === 'string') {
    try { return JSON.parse(perms); } catch { return {}; }
  }
  return perms;
}

export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

export function requireStats(req, res, next) {
  if (req.user.role === 'ADMIN' || req.user.see_stats === 1 || req.user.see_stats === true) {
    return next();
  }
  return res.status(403).json({ error: 'Statistics access disabled' });
}

export function requireModule(moduleName) {
  return (req, res, next) => {
    if (req.user.role === 'ADMIN') return next();
    const perms = parsePerms(req.user.permissions);
    if (perms[moduleName] === true) return next();
    return res.status(403).json({ error: `No permission for module: ${moduleName}` });
  };
}

export function requireAny(...moduleNames) {
  return (req, res, next) => {
    if (req.user.role === 'ADMIN') return next();
    const perms = parsePerms(req.user.permissions);
    if (moduleNames.some((m) => perms[m] === true)) return next();
    return res.status(403).json({ error: `No permission for modules: ${moduleNames.join(', ')}` });
  };
}