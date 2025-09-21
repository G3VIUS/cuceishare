// middleware/auth.js
const jwt = require('jsonwebtoken');

/**
 * Autentica peticiones con header:
 * Authorization: Bearer <token>
 *
 * Normaliza req.user para que SIEMPRE tenga:
 *   - req.user.id  (toma payload.id o payload.sub)
 *   - req.user.username (si venía en el token)
 *   - req.user.role     (si venía en el token)
 */
const authenticate = (req, res, next) => {
  const authHeader = req.header('Authorization') || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Normaliza para que todas las rutas puedan usar req.user.id
    const id = payload.id || payload.sub;
    req.user = {
      id,
      username: payload.username,
      role: payload.role,
      ...payload, // conserva el resto por si se necesita
    };

    if (!req.user.id) {
      return res.status(401).json({ error: 'Token sin id de usuario' });
    }

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido' });
  }
};

/**
 * Autoriza por rol. Uso:
 *   router.get('/admin', authenticate, authorize(['admin']), handler)
 */
const authorize = (roles = []) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'No autorizado' });
  }
  next();
};

module.exports = { authenticate, authorize };
