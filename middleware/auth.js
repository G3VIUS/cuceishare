// middleware/auth.js
const jwt = require('jsonwebtoken');

/** Autentica por JWT: Authorization: Bearer <token> */
function authenticate(req, res, next) {
  const authHeader = req.header('Authorization') || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const id = payload.id || payload.sub;
    if (!id) return res.status(401).json({ error: 'Token sin id de usuario' });

    req.user = {
      id,
      username: payload.username,
      role: payload.role,
      ...payload,
    };
    next();
  } catch (_e) {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

/** Autoriza por rol */
function authorize(roles = []) {
  return function (req, res, next) {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
