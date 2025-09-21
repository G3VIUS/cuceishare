// routes/auth.js
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db'); // usa el pool centralizado

function signToken({ id, username, role }) {
  return jwt.sign(
    { sub: id, username, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES || '2h' }
  );
}

/** POST /auth/register
 * body: { username, password, role?, nombre_completo?, correo? }
 */
router.post('/register', async (req, res) => {
  const { username, password, role, nombre_completo, correo } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'username y password son requeridos' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Inserta en usuarios
      const { rows: u } = await client.query(
        `insert into usuarios (username, password_hash, role, creado_en)
         values ($1, $2, coalesce($3,'estudiante'), now())
         returning id, username, role`,
        [username, hash, role]
      );

      // Inserta/crea perfil (opcional)
      await client.query(
        `insert into perfiles (usuario_id, nombre_completo, correo)
         values ($1, $2, $3)
         on conflict (usuario_id) do nothing`,
        [u[0].id, nombre_completo || null, correo || null]
      );

      await client.query('COMMIT');

      const token = signToken(u[0]);
      return res.json({ token, user: u[0] });
    } catch (e) {
      await client.query('ROLLBACK');

      const msg = String(e.message || '').toLowerCase();
      if (msg.includes('unique') && msg.includes('username')) {
        return res.status(409).json({ error: 'username ya existe' });
      }
      if (msg.includes('unique') && msg.includes('correo')) {
        return res.status(409).json({ error: 'correo ya existe' });
      }

      console.error('[REGISTER] error:', e);
      return res.status(500).json({ error: 'Error registrando usuario' });
    } finally {
      client.release();
    }
  } catch (e) {
    console.error('[REGISTER] fatal:', e);
    return res.status(500).json({ error: 'Error interno' });
  }
});

/** POST /auth/login
 * body: { username, password }
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'username y password son requeridos' });
  }

  try {
    const { rows } = await pool.query(
      `select id, username, password_hash, role
         from usuarios
        where lower(username) = lower($1)
        limit 1`,
      [username]
    );

    if (!rows.length) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    await pool.query(`update usuarios set ultimo_login = now() where id = $1`, [user.id]);

    const token = signToken(user);
    return res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (e) {
    console.error('[LOGIN] error:', e);
    return res.status(500).json({ error: 'Error iniciando sesión' });
  }
});

/** GET /auth/me
 * header: Authorization: Bearer <token>
 */
router.get('/me', async (req, res) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (!token || String(scheme).toLowerCase() !== 'bearer') {
    return res.status(401).json({ error: 'Token Bearer requerido' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const { rows } = await pool.query(
      `select u.id, u.username, u.role,
              p.nombre_completo, p.correo, p.avatar_url
         from usuarios u
    left join perfiles p on p.usuario_id = u.id
        where u.id = $1`,
      [payload.sub]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    return res.json({ user: rows[0] });
  } catch (e) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
});

module.exports = router;
