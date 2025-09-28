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

/* ---------------------------------------------
   Helpers de token (Bearer simple, sin middleware)
---------------------------------------------- */
function getBearer(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (!token || String(scheme).toLowerCase() !== 'bearer') return null;
  return token;
}
function verifyTokenOrNull(req) {
  const token = getBearer(req);
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

/* ---------------------------------------------
   Asegurar columnas/índice en perfiles
---------------------------------------------- */
async function ensurePerfilShape() {
  await pool.query(`
    do $$
    begin
      if not exists (
        select 1 from information_schema.columns
        where table_schema='public' and table_name='perfiles' and column_name='nombre'
      ) then alter table perfiles add column nombre text; end if;

      if not exists (
        select 1 from information_schema.columns
        where table_schema='public' and table_name='perfiles' and column_name='apellido'
      ) then alter table perfiles add column apellido text; end if;

      if not exists (
        select 1 from information_schema.columns
        where table_schema='public' and table_name='perfiles' and column_name='matricula'
      ) then alter table perfiles add column matricula text; end if;

      if not exists (
        select 1 from information_schema.columns
        where table_schema='public' and table_name='perfiles' and column_name='carrera'
      ) then alter table perfiles add column carrera text; end if;

      if not exists (
        select 1 from information_schema.columns
        where table_schema='public' and table_name='perfiles' and column_name='semestre'
      ) then alter table perfiles add column semestre text; end if;

      if not exists (
        select 1 from information_schema.columns
        where table_schema='public' and table_name='perfiles' and column_name='telefono'
      ) then alter table perfiles add column telefono text; end if;

      if not exists (
        select 1 from information_schema.columns
        where table_schema='public' and table_name='perfiles' and column_name='nombre_completo'
      ) then alter table perfiles add column nombre_completo text; end if;

      if not exists (
        select 1 from information_schema.columns
        where table_schema='public' and table_name='perfiles' and column_name='correo'
      ) then alter table perfiles add column correo text; end if;

      if not exists (
        select 1 from information_schema.columns
        where table_schema='public' and table_name='perfiles' and column_name='avatar_url'
      ) then alter table perfiles add column avatar_url text; end if;

      -- Índice único para ON CONFLICT (usuario_id)
      if not exists (
        select 1 from pg_indexes
        where schemaname='public' and tablename='perfiles' and indexname='perfiles_usuario_id_key'
      ) then
        begin
          alter table perfiles add constraint perfiles_usuario_id_key unique (usuario_id);
        exception when others then null;
        end;
      end if;
    end$$;
  `);
}

/* ---------------------------------------------
   POST /auth/register
---------------------------------------------- */
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

      const { rows: u } = await client.query(
        `insert into usuarios (username, password_hash, role, creado_en)
         values ($1, $2, coalesce($3,'estudiante'), now())
         returning id, username, role`,
        [username, hash, role]
      );

      await ensurePerfilShape();

      // Nota: no insertamos 'id' aquí tampoco
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

/* ---------------------------------------------
   POST /auth/login
---------------------------------------------- */
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

/* ---------------------------------------------
   GET /auth/me  -> { user, perfil }
---------------------------------------------- */
router.get('/me', async (req, res) => {
  const payload = verifyTokenOrNull(req);
  if (!payload) return res.status(401).json({ error: 'Token inválido o faltante' });

  try {
    await ensurePerfilShape();

    const { rows } = await pool.query(
      `select u.id, u.username, u.role,
              p.nombre, p.apellido, p.matricula, p.carrera, p.semestre, p.telefono,
              p.nombre_completo, p.correo, p.avatar_url
         from usuarios u
    left join perfiles p on p.usuario_id = u.id
        where u.id = $1
        limit 1`,
      [payload.sub]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const r = rows[0];
    const user = { id: r.id, username: r.username, role: r.role };
    const perfil = {
      nombre: r.nombre || '',
      apellido: r.apellido || '',
      matricula: r.matricula || '',
      carrera: r.carrera || '',
      semestre: r.semestre || '',
      telefono: r.telefono || '',
      nombre_completo: r.nombre_completo || '',
      correo: r.correo || '',
      avatar_url: r.avatar_url || ''
    };

    return res.json({ user, perfil });
  } catch (e) {
    console.error('[GET /auth/me]', e);
    return res.status(500).json({ error: 'No se pudo obtener el perfil' });
  }
});

/* ---------------------------------------------
   PUT /auth/profile  -> upsert por usuario_id
---------------------------------------------- */
router.put('/profile', async (req, res) => {
  const payload = verifyTokenOrNull(req);
  if (!payload) return res.status(401).json({ error: 'Token inválido o faltante' });

  const {
    nombre, apellido, matricula, carrera, semestre, telefono,
    correo, avatar_url
  } = req.body || {};

  try {
    await ensurePerfilShape();

    // 👇 Nota: sin 'id' en el INSERT para evitar choque integer/uuid
    await pool.query(
      `
      insert into perfiles (usuario_id, nombre, apellido, matricula, carrera, semestre, telefono, correo, avatar_url)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      on conflict (usuario_id) do update
         set nombre   = excluded.nombre,
             apellido = excluded.apellido,
             matricula= excluded.matricula,
             carrera  = excluded.carrera,
             semestre = excluded.semestre,
             telefono = excluded.telefono,
             correo   = coalesce(excluded.correo, perfiles.correo),
             avatar_url = coalesce(excluded.avatar_url, perfiles.avatar_url)
      `,
      [
        payload.sub,
        nombre || null,
        apellido || null,
        matricula || null,
        carrera || null,
        semestre || null,
        telefono || null,
        correo || null,
        avatar_url || null
      ]
    );

    return res.json({ ok: true });
  } catch (e) {
    console.error('[PUT /auth/profile] error:', e);
    return res.status(500).json({ error: 'No se pudo guardar el perfil' });
  }
});

module.exports = router;
