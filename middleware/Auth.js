const jwt = require('jsonwebtoken');
const SECRET = 'mi_clave_secreta';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization']; // leemos el header
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer <token>"

  if (!token) return res.status(401).json({ message: 'Token requerido' });

  jwt.verify(token, SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Token inválido' });
    req.user = user; // guardamos info del usuario en la request
    next();
  });
}

module.exports = authenticateToken;
