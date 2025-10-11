const pool = require('../db');
const jwt = require('jsonwebtoken');

// POST /auth/login
const login = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son obligatorios' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, username, role, password_hash
         FROM public.usuarios
        WHERE username = $1`,
      [username]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    const user = rows[0];

    const { rows: valid } = await pool.query(
      `SELECT crypt($1, $2) = $2 AS ok`,
      [password, user.password_hash]
    );
    if (!valid[0].ok) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const payload = { sub: user.id, username: user.username, role: user.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });

    return res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role }
    });
  } catch (err) {
    console.error('Error en login:', err);
    return res.status(500).json({ error: 'Error interno' });
  }
};

module.exports = { login };
