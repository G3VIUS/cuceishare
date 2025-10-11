// routes/apuntes.js
const express = require('express');
const multer = require('multer');

const { getSupabase } = require('../supabase'); // para URL firmadas si usas Storage
const { authenticate } = require('../middleware/auth');

// Controllers de DB (tu archivo)
const {
  listarApuntes,
  obtenerApunte,
  crearApunte,   // lo usaremos DESPUÉS de subir al storage
  borrarApunte
} = require('../controllers/apuntesController');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});

const BUCKET = process.env.SUPABASE_BUCKET || 'Apuntes';

/* ---------- helpers ---------- */

const getExt = (n='') => (String(n).toLowerCase().match(/\.([a-z0-9]+)$/i)?.[1] || '');
const isInlineMime = (mime='') => /^image\/|^application\/pdf$/i.test(mime);

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
function buildObjectKey(userId, originalName) {
  const ext = getExt(originalName) || 'bin';
  const base = slugifyBase(originalName);
  return `${userId}/apuntes/${Date.now()}-${base}.${ext}`;
}

/* ---------- Rutas ---------- */

/** GET /apuntes — lista (usa tu controller) */
router.get('/', listarApuntes);

/** GET /apuntes/:id — detalle (usa tu controller) */
router.get('/:id', obtenerApunte);

/**
 * POST /apuntes — crea apunte
 * - Si viene archivo (multipart), lo subimos a Supabase Storage con nombre saneado
 *   y luego llamamos a tu controller `crearApunte` con file_path/mime/size.
 * - Si no hay archivo, permite JSON con resource_url o file_path ya resuelto.
 */
router.post('/', authenticate, upload.single('file'), async (req, res) => {
  try {
    const { id: userId, username } = req.user || {};
    if (!userId) return res.status(401).json({ error: 'No autenticado' });

    // Si trae archivo, subimos a Storage
    if (req.file) {
      const supabase = getSupabase();
      const key = buildObjectKey(userId, req.file.originalname);

      const { error: upErr } = await supabase
        .storage
        .from(BUCKET)
        .upload(key, req.file.buffer, {
          cacheControl: '3600',
          upsert: false,
          contentType: req.file.mimetype || 'application/octet-stream'
        });

      if (upErr) {
        // Fallback nombre simple
        const fallbackKey = `${userId}/apuntes/${Date.now()}-archivo.${getExt(req.file.originalname) || 'bin'}`;
        const retry = await supabase
          .storage
          .from(BUCKET)
          .upload(fallbackKey, req.file.buffer, {
            cacheControl: '3600',
            upsert: false,
            contentType: req.file.mimetype || 'application/octet-stream'
          });
        if (retry.error) {
          console.error('[Storage upload error]', upErr, retry.error);
          return res.status(500).json({ error: 'Error subiendo archivo a Storage' });
        }
        // Reemplaza por fallback
        req.body.file_path = fallbackKey;
      } else {
        req.body.file_path = key;
      }

      req.body.file_mime = req.file.mimetype || null;
      req.body.file_size = req.file.size || null;
      // autor por defecto al username
      if (!req.body.autor) req.body.autor = username || null;
    }

    // Llama tu controller para insertar en DB con lo que haya en req.body
    return crearApunte(req, res);
  } catch (e) {
    console.error('[POST /apuntes] error', e);
    return res.status(500).json({ error: 'Error inesperado al crear apunte' });
  }
});

/**
 * GET /apuntes/:id/url — devuelve { url, mime }
 * Compatible con:
 *  - resource_url (externo)
 *  - file_path de Supabase Storage (firma URL)
 *  - file_path local /uploads/...
 */
router.get('/:id/url', async (req, res) => {
  try {
    // reutilizamos tu controller para obtener datos del apunte
    const fakeRes = {
      _json: null,
      status: () => fakeRes,
      json: (x) => { fakeRes._json = x; return x; }
    };
    await obtenerApunte(req, fakeRes);
    const row = fakeRes._json;
    if (!row || row.error) return res.status(row?.status || 404).json(row || { error: 'No existe' });

    // 1) Si hay resource_url externo
    if (row.resource_url) {
      return res.json({ url: row.resource_url, mime: row.file_mime || null });
    }

    // 2) Si hay file_path local (/uploads/...)
    if (row.file_path && String(row.file_path).startsWith('/uploads/')) {
      const absUrl = `${req.protocol}://${req.get('host')}${row.file_path}`;
      return res.json({ url: absUrl, mime: row.file_mime || null });
    }

    // 3) Si hay file_path de Supabase Storage (key tipo "user/apuntes/...")
    if (row.file_path && !/^https?:\/\//i.test(row.file_path)) {
      const supabase = getSupabase();
      const { data: signed, error: signErr } =
        await supabase.storage.from(BUCKET).createSignedUrl(row.file_path, 60 * 60, {
          // si quieres forzar descarga, usa { download: 'nombre.ext' }
        });
      if (!signErr && signed?.signedUrl) {
        return res.json({ url: signed.signedUrl, mime: row.file_mime || null });
      }
      // fallback público (si el bucket fuera público)
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(row.file_path);
      if (pub?.publicUrl) return res.json({ url: pub.publicUrl, mime: row.file_mime || null });
    }

    return res.status(404).json({ error: 'No hay URL disponible' });
  } catch (e) {
    console.error('[GET /apuntes/:id/url] error', e);
    return res.status(500).json({ error: 'Error inesperado' });
  }
});

/**
 * GET /apuntes/:id/file — redirige a la URL (soporta ?download=1)
 */
router.get('/:id/file', async (req, res) => {
  try {
    const forceDownload = String(req.query.download || '') === '1';

    const fakeRes = {
      _json: null,
      status: () => fakeRes,
      json: (x) => { fakeRes._json = x; return x; }
    };
    await obtenerApunte(req, fakeRes);
    const row = fakeRes._json;
    if (!row || row.error) return res.status(row?.status || 404).json(row || { error: 'No existe' });

    if (row.resource_url) return res.redirect(302, row.resource_url);

    if (row.file_path && String(row.file_path).startsWith('/uploads/')) {
      const absUrl = `${req.protocol}://${req.get('host')}${row.file_path}`;
      return res.redirect(302, absUrl);
    }

    if (row.file_path && !/^https?:\/\//i.test(row.file_path)) {
      const supabase = getSupabase();
      const opts = forceDownload ? { download: row.file_path.split('/').pop() || 'archivo' } : {};
      const { data: signed, error: signErr } =
        await supabase.storage.from(BUCKET).createSignedUrl(row.file_path, 60 * 60, opts);
      if (!signErr && signed?.signedUrl) return res.redirect(302, signed.signedUrl);

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(row.file_path);
      if (pub?.publicUrl) return res.redirect(302, pub.publicUrl);
    }

    return res.status(404).json({ error: 'El apunte no tiene archivo' });
  } catch (e) {
    console.error('[GET /apuntes/:id/file] error', e);
    return res.status(500).json({ error: 'Error inesperado' });
  }
});

/** DELETE /apuntes/:id — usa tu controller (borra en DB y quita local si /uploads/...) */
router.delete('/:id', authenticate, borrarApunte);

module.exports = router;
