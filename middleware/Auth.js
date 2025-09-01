const jwt = require('jsonwebtoken');
require('dotenv').config();
const { findById } = require('../controllers/AuthController');

const SECRET_SIGN = process.env.JWT_ACCESS_SECRET;

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization']; 
  const token = authHeader && authHeader.split(' ')[1]; 
  if (!token) return res.status(401).json({ message: 'Token requerido' });

  try {
    const payload = jwt.verify(token, SECRET_SIGN); // lanza error si no es válido
    if (!payload) return res.status(403).json({ message: 'No autenticado' });
    req.user = await findById(payload.id);
    if (!req.user) return res.status(404).json({ message: 'Usuario no encontrado' });
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Token inválido' });
  }
}

module.exports = authenticateToken;
