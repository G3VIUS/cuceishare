// routes/apuntes.js
const express = require('express');
const multer = require('multer');
const { getSupabase } = require('../supabase');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});
const BUCKET = process.env.SUPABASE_BUCKET || 'Apuntes';

/* ----------------- helpers ----------------- */
const getExt = (n = '') =>
  (String(n).toLowerCase().match(/\.([a-z0-9]+)$/i)?.[1] || '');

const isInlineMime = (mime = '') =>
  /^image\/|^application\/pdf$/i.test(mime);

/** Quita acentos/espacios y caracteres problemáticos del nombre (sin extensión) */
function slugifyBase(name = 'archivo') {
  const base = String(name).replace(/\.[^.]+$/, '');
  const clean = base
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .replace(/-+/g, '-')
    .slice(0, 80)
    .trim();
  return clean || 'archivo';
}

/** Construye una key segura para Supabase Storage */
function buildObjectKey(userId, originalName) {
  const ext = getExt(originalName) || 'bin';
  const base = slugifyBase(originalName);
  return `${userId}/apuntes/${Date.now()}-${base}.${ext}`;
}

/* ----------------- Endpoints ----------------- */

/** GET /apuntes — lista (ordenada por creado_en DESC) */
router.get('/', async (req, res) => {
  const t0 = Date.now();
  let debug = {
    receivedParams: { ...req.query },
    filters: {},
    notes: [],
  };

  try {
    const supabase = getSupabase();

    const q        = (req.query.q || '').toString().trim();
    const materia  = (req.query.materia || '').toString().trim();
    const blockId  = (req.query.blockId || '').toString().trim();
    const wantDbg  = String(req.query._debug || '') === '1';

    const limit  = Math.min(parseInt(req.query.limit || '20', 10) || 20, 100);
    const offset = parseInt(req.query.offset || '0', 10) || 0;

    debug.filters.limit = limit;
    debug.filters.offset = offset;
    debug.filters.materia = materia || null;
    debug.filters.blockId = blockId || null;

    let query = supabase
      .from('apuntes')
      .select(
        'id,titulo,descripcion,autor,subject_slug,block_id,visibilidad,tags,file_url,file_path,file_mime,creado_en',
        { count: 'exact' }
      )
      .order('creado_en', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + limit - 1);

    // visibilidad
    query = query.eq('visibilidad', 'public');
    debug.filters.visibilidad = 'public';

    // Filtros estructurados
    if (materia)  { query = query.eq('subject_slug', materia); debug.filters.subject_slug = materia; }
    if (blockId)  { query = query.eq('block_id', blockId);     debug.filters.block_id     = blockId; }

    // Búsqueda libre: sanea caracteres que rompen or(...)
    if (q) {
      const safe = q.replace(/[(),]/g, ' ').trim();
      debug.filters.q = q;
      debug.filters.qSafe = safe;
      query = query.or(`titulo.ilike.*${safe}*,descripcion.ilike.*${safe}*`);
    }

    const { data, error, count } = await query;

    debug.count = count ?? null;
    debug.elapsedMs = Date.now() - t0;

    if (error) {
      console.error('[GET /apuntes] error', error);
      debug.error = error;
      return res.status(500).json({
        error: 'Error al listar apuntes',
        ...(wantDbg ? { debug } : {}),
      });
    }

    // Log consola resumido
    console.log('[GET /apuntes]', {
      materia: materia || null,
      blockId: blockId || null,
      q: q || null,
      returned: (data || []).length,
      total: count ?? null,
      elapsedMs: debug.elapsedMs,
    });

    const payload = { items: data || [], total: count ?? 0, limit, offset };
    if (wantDbg) payload.debug = debug;
    return res.json(payload);
  } catch (e) {
    console.error('[GET /apuntes] error', e);
    debug.caught = String(e && e.message || e);
    return res.status(500).json({
      error: 'Error inesperado',
      ...(String(req.query._debug || '') === '1' ? { debug } : {}),
    });
  }
});

/** POST /apuntes — crea apunte (sube a Storage opcionalmente) */
router.post('/', authenticate, upload.single('file'), async (req, res) => {
  try {
    const supabase = getSupabase();
    const { id: localUserId, username } = req.user || {};
    if (!localUserId) return res.status(401).json({ error: 'No autenticado' });

    const {
      titulo,
      descripcion,
      subject_slug,
      visibilidad = 'public',
      autor,
      resource_url,
      block_id, // uuid del bloque
    } = req.body;

    if (!titulo || !descripcion) {
      return res.status(400).json({ error: 'Título y descripción son obligatorios.' });
    }

    // Normaliza tags a array (jsonb)
    let tagsArr = [];
    if (req.body.tags) {
      try {
        tagsArr = Array.isArray(req.body.tags) ? req.body.tags : JSON.parse(req.body.tags);
      } catch {
        tagsArr = String(req.body.tags).split(',').map(t => t.trim()).filter(Boolean);
      }
    }

    const safeAutor = (autor || username || 'anon').toString();

    // 1) Storage (opcional)
    let uploaded = null;
    if (req.file) {
      const objectPath = buildObjectKey(localUserId, req.file.originalname);
      const up = await supabase.storage
        .from(BUCKET)
        .upload(objectPath, req.file.buffer, {
          cacheControl: '3600',
          upsert: false,
          contentType: req.file.mimetype || 'application/octet-stream',
        });

      if (up.error) {
        console.error('[Storage upload error]', up.error);
        const fallbackPath = `${localUserId}/apuntes/${Date.now()}-archivo.${getExt(req.file.originalname) || 'bin'}`;
        const retry = await supabase.storage
          .from(BUCKET)
          .upload(fallbackPath, req.file.buffer, {
            cacheControl: '3600',
            upsert: false,
            contentType: req.file.mimetype || 'application/octet-stream',
          });
        if (retry.error) {
          console.error('[Storage upload retry error]', retry.error);
          return res.status(500).json({ error: 'Error subiendo a Storage' });
        } else {
          const { data: pub2 } = supabase.storage.from(BUCKET).getPublicUrl(fallbackPath);
          uploaded = {
            path: fallbackPath,
            public_url: pub2?.publicUrl || null,
            mime: req.file.mimetype || null,
            size: req.file.size || null,
          };
        }
      } else {
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
        uploaded = {
          path: objectPath,
          public_url: pub?.publicUrl || null,
          mime: req.file.mimetype || null,
          size: req.file.size || null,
        };
      }
    }

    // 2) Insert
    const fila = {
      titulo: String(titulo).trim(),
      descripcion: String(descripcion).trim(),
      autor: safeAutor,
      subject_slug: subject_slug || null,
      visibilidad,
      tags: tagsArr,
      resource_url: !req.file && resource_url ? String(resource_url).trim() : null,
      file_path: uploaded?.path || null,
      file_mime: uploaded?.mime || null,
      file_size: uploaded?.size || null,
      file_url: uploaded?.public_url || null,
      block_id: block_id || null,
    };

    const { data: insertRes, error: insErr } = await supabase
      .from('apuntes')
      .insert(fila)
      .select('id')
      .single();

    if (insErr) {
      console.error('[Insert apuntes error]', insErr);
      return res.status(500).json({ error: 'Error guardando apunte' });
    }

    return res.status(201).json({ id: insertRes.id });
  } catch (e) {
    console.error('[POST /apuntes] error', e);
    const msg = /\[Supabase\] Faltan/.test(e.message)
      ? 'Config de Supabase incompleta en backend'
      : 'Error inesperado';
    return res.status(500).json({ error: msg });
  }
});

/** GET /apuntes/:id — devuelve la fila */
router.get('/:id', async (req, res) => {
  try {
    const supabase = getSupabase();
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID inválido' });

    const { data, error } = await supabase
      .from('apuntes')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      console.error('[Select apunte error]', error);
      return res.status(500).json({ error: 'Error consultando apunte' });
    }
    if (!data) return res.status(404).json({ error: 'No existe' });

    return res.json(data);
  } catch (e) {
    console.error('[GET /apuntes/:id] error', e);
    return res.status(500).json({ error: 'Error inesperado' });
  }
});

/**
 * GET /apuntes/:id/url — devuelve { url, mime }
 */
router.get('/:id/url', async (req, res) => {
  try {
    const supabase = getSupabase();
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID inválido' });

    const { data: row, error } = await supabase
      .from('apuntes')
      .select('file_path,file_url,resource_url,file_mime')
      .eq('id', id)
      .single();
    if (error) {
      console.error('[Select url error]', error);
      return res.status(500).json({ error: 'Error consultando apunte' });
    }
    if (!row) return res.status(404).json({ error: 'No existe' });

    if (row.resource_url) return res.json({ url: row.resource_url, mime: row.file_mime || null });
    if (row.file_url)     return res.json({ url: row.file_url,     mime: row.file_mime || null });

    if (row.file_path) {
      const { data: signed, error: signErr } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(row.file_path, 60 * 60);
      if (!signErr && signed?.signedUrl) {
        return res.json({ url: signed.signedUrl, mime: row.file_mime || null });
      }
      const { data: pub } = await supabase.storage.from(BUCKET).getPublicUrl(row.file_path);
      if (pub?.publicUrl) {
        return res.json({ url: pub.publicUrl, mime: row.file_mime || null });
      }
    }

    return res.status(404).json({ error: 'No hay archivo asociado' });
  } catch (e) {
    console.error('[GET /apuntes/:id/url] error', e);
    return res.status(500).json({ error: 'Error inesperado' });
  }
});

/* =======================
   PUT /apuntes/:id — editar
   ======================= */
router.put('/:id', authenticate, upload.single('file'), async (req, res) => {
  try {
    const supabase = getSupabase();
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID inválido' });

    const { data: current, error: selErr } = await supabase
      .from('apuntes')
      .select('*')
      .eq('id', id)
      .single();
    if (selErr) {
      console.error('[PUT select error]', selErr);
      return res.status(500).json({ error: 'Error consultando apunte' });
    }
    if (!current) return res.status(404).json({ error: 'No existe' });

    const reqUser = (req.user?.username || '').trim().toLowerCase();
    const rowAuthor = (current.autor || '').trim().toLowerCase();
    if (rowAuthor && rowAuthor !== reqUser) {
      return res.status(403).json({ error: 'No tienes permiso para editar este apunte' });
    }

    const {
      titulo,
      descripcion,
      subject_slug,
      visibilidad,
      resource_url,
      autor,
      block_id,
    } = req.body;

    let tagsArr = current.tags || [];
    if (req.body.tags !== undefined) {
      try {
        if (Array.isArray(req.body.tags)) tagsArr = req.body.tags;
        else tagsArr = JSON.parse(req.body.tags);
      } catch {
        tagsArr = String(req.body.tags).split(',').map(t => t.trim()).filter(Boolean);
      }
    }

    let newFile = null;
    let removeOldFromStorage = false;

    if (req.file) {
      const objectPath = buildObjectKey(req.user.id, req.file.originalname);
      const up = await supabase.storage
        .from(BUCKET)
        .upload(objectPath, req.file.buffer, {
          cacheControl: '3600',
          upsert: false,
          contentType: req.file.mimetype || 'application/octet-stream',
        });

      if (up.error) {
        console.error('[Storage upload error]', up.error);
        const fallbackPath = `${req.user.id}/apuntes/${Date.now()}-archivo.${getExt(req.file.originalname) || 'bin'}`;
        const retry = await supabase.storage
          .from(BUCKET)
          .upload(fallbackPath, req.file.buffer, {
            cacheControl: '3600',
            upsert: false,
            contentType: req.file.mimetype || 'application/octet-stream',
          });
        if (retry.error) {
          console.error('[Storage upload retry error]', retry.error);
          return res.status(500).json({ error: 'Error subiendo archivo a Storage' });
        }
        const { data: pub2 } = supabase.storage.from(BUCKET).getPublicUrl(fallbackPath);
        newFile = {
          file_path: fallbackPath,
          file_mime: req.file.mimetype || null,
          file_size: req.file.size || null,
          file_url: pub2?.publicUrl || null,
        };
      } else {
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
        newFile = {
          file_path: objectPath,
          file_mime: req.file.mimetype || null,
          file_size: req.file.size || null,
          file_url: pub?.publicUrl || null,
        };
      }

      if (current.file_path && !/^https?:\/\//i.test(current.file_path) && !current.file_path.startsWith('/uploads/')) {
        removeOldFromStorage = true;
      }
    }

    const patch = {};
    if (titulo       !== undefined) patch.titulo       = String(titulo).trim();
    if (descripcion  !== undefined) patch.descripcion  = String(descripcion).trim();
    if (subject_slug !== undefined) patch.subject_slug = subject_slug || null;
    if (visibilidad  !== undefined) patch.visibilidad  = visibilidad || 'public';
    if (req.body.tags!== undefined) patch.tags         = tagsArr;
    if (block_id     !== undefined) patch.block_id     = block_id || null;

    if (resource_url !== undefined) {
      const r = String(resource_url || '').trim();
      patch.resource_url = r || null;
      if (r) {
        patch.file_path = null;
        patch.file_mime = null;
        patch.file_size = null;
        patch.file_url  = null;
      }
    }

    if (autor !== undefined) {
      const newAutor = String(autor || '').trim();
      if (newAutor && newAutor.toLowerCase() !== reqUser) {
        return res.status(400).json({ error: 'No puedes cambiar el autor a un usuario distinto' });
      }
      patch.autor = newAutor || current.autor || req.user.username || 'anon';
    }

    if (newFile) {
      patch.file_path = newFile.file_path;
      patch.file_mime = newFile.file_mime;
      patch.file_size = newFile.file_size;
      patch.file_url  = newFile.file_url;
      patch.resource_url = null;
    }

    if (Object.keys(patch).length === 0) {
      return res.json({ ok: true, unchanged: true });
    }

    const { error: updErr } = await supabase
      .from('apuntes')
      .update(patch)
      .eq('id', id);
    if (updErr) {
      console.error('[PUT update error]', updErr);
      return res.status(500).json({ error: 'Error actualizando apunte' });
    }

    if (removeOldFromStorage) {
      const { error: rmErr } = await supabase.storage.from(BUCKET).remove([current.file_path]);
      if (rmErr) console.warn('[Storage remove warning]', rmErr);
    }

    const { data: finalRow, error: selErr2 } = await supabase
      .from('apuntes')
      .select('*')
      .eq('id', id)
      .single();
    if (selErr2) {
      console.error('[PUT reselect error]', selErr2);
      return res.status(200).json({ ok: true });
    }
    return res.json(finalRow);
  } catch (e) {
    console.error('[PUT /apuntes/:id] error', e);
    return res.status(500).json({ error: 'Error inesperado' });
  }
});

/** DELETE /apuntes/:id — elimina apunte y su archivo */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const supabase = getSupabase();
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID inválido' });

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

    const reqUser = (req.user?.username || '').trim().toLowerCase();
    const rowAuthor = (row.autor || '').trim().toLowerCase();
    const authorMatches = !row.autor || (rowAuthor && rowAuthor === reqUser);

    if (!authorMatches) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar este apunte' });
    }

    if (row.file_path && !/^https?:\/\//i.test(row.file_path) && !row.file_path.startsWith('/uploads/')) {
      const { error: rmErr } = await supabase.storage.from(BUCKET).remove([row.file_path]);
      if (rmErr) console.warn('[Storage remove warning]', rmErr);
    }

    const { error: delErr } = await supabase
      .from('apuntes')
      .delete()
      .eq('id', id);
    if (delErr) {
      console.error('[DELETE DB error]', delErr);
      return res.status(500).json({ error: 'Error eliminando apunte' });
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error('[DELETE /apuntes/:id] error', e);
    return res.status(500).json({ error: 'Error inesperado' });
  }
});

module.exports = router;
