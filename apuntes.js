// routes/apuntes.js
console.log('[apuntes.js] cargado v6');

const express = require('express');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const { getSupabase } = require('../supabase');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// --- Config ---
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});
const BUCKET = process.env.SUPABASE_BUCKET || 'Apuntes';

// utils
const isHttpUrl = (s = '') => /^https?:\/\//i.test(s);
const norm = (s) => (s || '').toString().trim().toLowerCase();

/* =========================================================
   DEBUG (antes de /:id)
   ========================================================= */
router.get('/_whoami', authenticate, (req, res) => {
  res.json({ here: 'apuntes-router', user: req.user });
});

/* =========================================================
   GET /apuntes — listado (público). Soporta ?q, ?limit, ?offset
   También ?mine=1 para listar "mis apuntes" (requiere token)
   ========================================================= */
router.get('/', async (req, res) => {
  const supabase = getSupabase();

  const q = (req.query.q || '').toString().trim();
  const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
  const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);
  const mine = String(req.query.mine || '').toLowerCase() === '1'
            || String(req.query.mine || '').toLowerCase() === 'true';

  try {
    let query = supabase
      .from('apuntes')
      .select(
        'id,titulo,descripcion,autor,subject_slug,visibilidad,tags,file_url,file_path,file_mime,creado_en',
        { count: 'exact' },
      )
      .order('creado_en', { ascending: false })
      .range(offset, offset + limit - 1);

    if (q) query = query.or(`titulo.ilike.%${q}%,autor.ilike.%${q}%`);

    if (mine) {
      const raw = req.headers.authorization || '';
      const m = raw.match(/^Bearer\s+(.+)$/i);
      if (!m) return res.status(401).json({ error: 'No autenticado' });
      let payload;
      try { payload = jwt.verify(m[1], process.env.JWT_SECRET); }
      catch { return res.status(401).json({ error: 'Token inválido o expirado' }); }
      const myUser = (payload.username || '').toString();
      if (!myUser) return res.status(401).json({ error: 'Token sin username' });
      query = query.eq('autor', myUser);
    }

    const { data, error, count } = await query;
    if (error) {
      console.error('[GET /apuntes] supabase error:', error);
      return res.status(500).json({ error: 'No se pudieron listar los apuntes' });
    }

    return res.json({
      items: data || [],
      total: count ?? (data ? data.length : 0),
      limit,
      offset,
    });
  } catch (e) {
    console.error('[GET /apuntes] catch:', e);
    if (String(e).includes('fetch failed')) {
      return res.status(503).json({ error: 'Servicio de datos no disponible' });
    }
    return res.status(500).json({ error: 'Error interno' });
  }
});

/* =========================================================
   Validador del parámetro :id  (numérico)
   ========================================================= */
router.param('id', (req, res, next, val) => {
  if (!/^\d+$/.test(String(val))) {
    return res.status(400).json({ error: 'ID inválido' });
  }
  next();
});

/* =========================================================
   GET /apuntes/:id — detalle
   ========================================================= */
router.get('/:id', async (req, res) => {
  const supabase = getSupabase();
  const id = Number(req.params.id);

  try {
    const { data, error } = await supabase
      .from('apuntes')
      .select('id,titulo,descripcion,autor,subject_slug,visibilidad,tags,file_url,file_path,file_mime,creado_en')
      .eq('id', id)
      .single();

    if (error) {
      console.error('[GET /apuntes/:id] error:', error);
      return res.status(500).json({ error: 'No se pudo consultar el apunte' });
    }
    if (!data) return res.status(404).json({ error: 'No existe' });

    return res.json(data);
  } catch (e) {
    console.error('[GET /apuntes/:id] catch:', e);
    return res.status(500).json({ error: 'Error interno' });
  }
});

/* =========================================================
   GET /apuntes/:id/url — URL del archivo
   ========================================================= */
router.get('/:id/url', async (req, res) => {
  const supabase = getSupabase();
  const id = Number(req.params.id);

  try {
    const { data: row, error } = await supabase
      .from('apuntes')
      .select('file_url,file_path,file_mime')
      .eq('id', id)
      .single();

    if (error) {
      console.error('[GET /apuntes/:id/url] error:', error);
      return res.status(500).json({ error: 'No se pudo consultar el apunte' });
    }
    if (!row) return res.status(404).json({ error: 'No existe' });

    if (row.file_url && isHttpUrl(row.file_url)) {
      return res.json({ url: row.file_url, mime: row.file_mime || null });
    }

    if (row.file_path && !row.file_path.startsWith('/uploads/')) {
      const { data: signed, error: sErr } = await supabase
        .storage
        .from(BUCKET)
        .createSignedUrl(row.file_path, 60 * 10);
      if (sErr) {
        console.error('[signedUrl error]', sErr);
        return res.status(500).json({ error: 'No se pudo generar URL' });
      }
      return res.json({ url: signed?.signedUrl || null, mime: row.file_mime || null });
    }

    if (row.file_path && row.file_path.startsWith('/uploads/')) {
      return res.json({ url: row.file_path, mime: row.file_mime || null });
    }

    return res.status(404).json({ error: 'Sin archivo' });
  } catch (e) {
    console.error('[GET /apuntes/:id/url] catch:', e);
    return res.status(500).json({ error: 'Error interno' });
  }
});

/* =========================================================
   GET /apuntes/:id/file — redirige a la URL
   ========================================================= */
router.get('/:id/file', async (req, res) => {
  const supabase = getSupabase();
  const id = Number(req.params.id);

  try {
    const { data: row, error } = await supabase
      .from('apuntes')
      .select('file_url,file_path')
      .eq('id', id)
      .single();

    if (error) {
      console.error('[GET /apuntes/:id/file] error:', error);
      return res.status(500).send('Error consultando apunte');
    }
    if (!row) return res.status(404).send('No existe');

    if (row.file_url && isHttpUrl(row.file_url)) return res.redirect(row.file_url);

    if (row.file_path && !row.file_path.startsWith('/uploads/')) {
      const { data: signed, error: sErr } = await supabase
        .storage
        .from(BUCKET)
        .createSignedUrl(row.file_path, 60 * 10);
      if (sErr || !signed?.signedUrl) {
        console.error('[signedUrl error]', sErr);
        return res.status(500).send('No se pudo generar URL');
      }
      return res.redirect(signed.signedUrl);
    }

    if (row.file_path && row.file_path.startsWith('/uploads/')) {
      return res.redirect(row.file_path);
    }

    return res.status(404).send('Sin archivo');
  } catch (e) {
    console.error('[GET /apuntes/:id/file] catch:', e);
    return res.status(500).send('Error interno');
  }
});

/* =========================================================
   POST /apuntes — crear (requiere token)
   ========================================================= */
router.post('/', authenticate, upload.single('file'), async (req, res) => {
  const supabase = getSupabase();
  try {
    const { titulo, descripcion, autor, subject_slug, visibilidad = 'public', tags = [] } = req.body || {};
    const username = req.user?.username || autor || null;

    let file_path = null;
    let file_mime = null;
    let file_url = null;

    if (req.file) {
      const key = `uploads/${Date.now()}_${(req.file.originalname || 'archivo').replace(/\s+/g, '_')}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(key, req.file.buffer, {
          contentType: req.file.mimetype || 'application/octet-stream',
          upsert: false,
        });
      if (upErr) {
        console.error('[UPLOAD error]', upErr);
        return res.status(500).json({ error: 'No se pudo subir el archivo' });
      }
      file_path = key;
      file_mime = req.file.mimetype || null;
    }

    const { data, error } = await supabase
      .from('apuntes')
      .insert([{
        titulo: titulo || null,
        descripcion: descripcion || null,
        autor: username,
        subject_slug: subject_slug || null,
        visibilidad,
        tags: Array.isArray(tags) ? tags : [],
        file_url,
        file_path,
        file_mime,
      }])
      .select('id')
      .single();

    if (error) {
      console.error('[INSERT apunte error]', error);
      return res.status(500).json({ error: 'No se pudo crear el apunte' });
    }

    return res.json({ ok: true, id: data?.id });
  } catch (e) {
    console.error('[POST /apuntes] catch:', e);
    return res.status(500).json({ error: 'Error interno' });
  }
});

/* =========================================================
   PUT /apuntes/:id — editar (solo dueño o admin)
   ========================================================= */
router.put('/:id', authenticate, upload.single('file'), async (req, res) => {
  const supabase = getSupabase();
  const id = Number(req.params.id);

  try {
    const { data: row, error: selErr } = await supabase
      .from('apuntes')
      .select('id,autor,file_path')
      .eq('id', id)
      .single();

    if (selErr) {
      console.error('[PUT select error]', selErr);
      return res.status(500).json({ error: 'Error consultando apunte' });
    }
    if (!row) return res.status(404).json({ error: 'No existe' });

    const isAdmin = norm(req.user?.role) === 'admin';
    const isOwner = !row.autor || (norm(row.autor) === norm(req.user?.username));
    if (!(isAdmin || isOwner)) return res.status(403).json({ error: 'No tienes permiso para editar este apunte' });

    const patch = {};
    ['titulo', 'descripcion', 'subject_slug', 'visibilidad'].forEach((k) => {
      if (k in req.body) patch[k] = req.body[k];
    });
    if ('tags' in req.body) patch.tags = Array.isArray(req.body.tags) ? req.body.tags : [];

    if (req.file) {
      if (row.file_path && !isHttpUrl(row.file_path) && !row.file_path.startsWith('/uploads/')) {
        const { error: rmErr } = await supabase.storage.from(BUCKET).remove([row.file_path]);
        if (rmErr) console.warn('[Storage remove warning]', rmErr);
      }
      const key = `uploads/${Date.now()}_${(req.file.originalname || 'archivo').replace(/\s+/g, '_')}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(key, req.file.buffer, {
          contentType: req.file.mimetype || 'application/octet-stream',
          upsert: false,
        });
      if (upErr) {
        console.error('[UPLOAD error]', upErr);
        return res.status(500).json({ error: 'No se pudo subir el archivo' });
      }
      patch.file_path = key;
      patch.file_mime = req.file.mimetype || null;
      patch.file_url  = null;
    }

    const { error: updErr } = await supabase.from('apuntes').update(patch).eq('id', id);
    if (updErr) {
      console.error('[PUT update error]', updErr);
      return res.status(500).json({ error: 'No se pudo actualizar el apunte' });
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error('[PUT /apuntes/:id] catch]', e);
    return res.status(500).json({ error: 'Error interno' });
  }
});

/* =========================================================
   DELETE /apuntes/:id — ADMIN siempre puede; dueño por autor también
   ========================================================= */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const supabase = getSupabase();
    const id = Number(req.params.id);

    // fila
    const { data: row, error: selErr } = await supabase
      .from('apuntes')
      .select('id,file_path,autor')
      .eq('id', id)
      .single();

    if (selErr) {
      console.error('[DELETE select error]', selErr);
      return res.status(500).json({ error: 'Error consultando apunte' });
    }
    if (!row) return res.status(404).json({ error: 'No existe' });

    // Admin bypass
    if (norm(req.user?.role) === 'admin') {
      if (row.file_path && !isHttpUrl(row.file_path) && !row.file_path.startsWith('/uploads/')) {
        const { error: rmErr } = await supabase.storage.from(BUCKET).remove([row.file_path]);
        if (rmErr) console.warn('[Storage remove warning]', rmErr);
      }
      const { error: delErr } = await supabase.from('apuntes').delete().eq('id', id);
      if (delErr) {
        console.error('[DELETE DB error]', delErr);
        return res.status(500).json({ error: 'No se pudo borrar el apunte' });
      }
      return res.json({ ok: true });
    }

    // Dueño por autor
    const isOwner = !row.autor || (norm(row.autor) === norm(req.user?.username));
    if (!isOwner) return res.status(403).json({ error: 'No tienes permiso para eliminar este apunte' });

    if (row.file_path && !isHttpUrl(row.file_path) && !row.file_path.startsWith('/uploads/')) {
      const { error: rmErr } = await supabase.storage.from(BUCKET).remove([row.file_path]);
      if (rmErr) console.warn('[Storage remove warning]', rmErr);
    }
    const { error: delErr } = await supabase.from('apuntes').delete().eq('id', id);
    if (delErr) {
      console.error('[DELETE DB error]', delErr);
      return res.status(500).json({ error: 'No se pudo borrar el apunte' });
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error('[DELETE /apuntes/:id] catch:', e);
    return res.status(500).json({ error: 'Error inesperado' });
  }
});

module.exports = router;
