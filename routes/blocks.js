// routes/blocks.js
const express = require('express');
const { getSupabase } = require('../supabase');

const router = express.Router();

/**
 * Mapa de prefijos del campo blocks.code -> slug de materia (heurística)
 * Ajusta los prefijos según tus códigos reales (del JSON que pasaste).
 */
const CODE_PREFIX_MAP = {
  'as-':  'aserv',        // Administración de Servidores (as-u1, as-u2, ...)
  'md-':  'mineria',      // Minería de Datos (md-u1, md-u2, ...)
  'red-': 'redes',        // Redes (red-u1, ...)
  'tc-':  'teoria',       // Teoría de la Computación (tc-u1, ...)
  'alg-': 'algoritmia',   // Algoritmia (alg-u1, ...)
  'prg-': 'programacion', // Programación (por si usas prg-.. además de PRG-..)
  'PRG-': 'programacion', // Programación (PRG-01...)
  'IS':   'isw',          // Ing. de Software (IS1, IS2...)
  'SEG':  'seguridad',    // Seguridad (SEG1, SEG2...)
  // ED1: ejemplos variados (td-struct, poo)
  'td-':  'ed1',
  'poo':  'ed1',
};

/**
 * Intenta resolver un subject_slug (o subject_id) a un subject_id (UUID) real.
 * - Si 'slug' ya es un UUID válido -> lo devuelve directo.
 * - Si existe tabla 'materia_map' (slug->subject_id), la usa.
 * - Si existe 'subjects.slug' o 'subjects.route_slug', la usa.
 * - Si no, INFIERA subject_id buscando un bloque cuyo code matchee un prefijo
 *   mapeado a ese slug.
 */
async function resolveSubjectId(supabase, slugOrId) {
  const s = String(slugOrId || '').trim();
  if (!s) return null;

  // 1) ¿Ya viene como UUID?
  if (/^[0-9a-f-]{36}$/i.test(s)) return s;

  // 2) materia_map
  const map = await supabase
    .from('materia_map')
    .select('subject_id')
    .eq('slug', s)
    .maybeSingle();
  if (!map.error && map.data?.subject_id) return map.data.subject_id;

  // 3) subjects.slug / subjects.route_slug
  const subj = await supabase
    .from('subjects')
    .select('id')
    .or(`slug.eq.${s},route_slug.eq.${s}`)
    .maybeSingle();
  if (!subj.error && subj.data?.id) return subj.data.id;

  // 4) Heurística por prefijo de code
  //    Buscamos en CODE_PREFIX_MAP la(s) clave(s) cuyo valor coincida con 's'
  const entries = Object.entries(CODE_PREFIX_MAP).filter(([, v]) => v === s);
  for (const [prefix] of entries) {
    const q = await supabase
      .from('blocks')
      .select('subject_id, code')
      .ilike('code', `${prefix}%`)
      .limit(1);
    if (!q.error && q.data?.[0]?.subject_id) {
      return q.data[0].subject_id;
    }
  }

  return null;
}

async function fetchBlocksBySubjectKey(subjectKey) {
  const supabase = getSupabase();

  const subjectId = await resolveSubjectId(supabase, subjectKey);
  if (!subjectId) {
    return { errorMessage: `No se encontró la materia '${subjectKey}'` };
  }

  const { data, error } = await supabase
    .from('blocks')
    .select('id, titulo, code, orden')
    .eq('subject_id', subjectId)
    .order('orden', { ascending: true })
    .order('titulo', { ascending: true });

  if (error) {
    return { errorMessage: 'Error consultando bloques', detail: error };
  }

  const items = (data || []).map((b) => ({
    id: b.id,                                       // UUID
    title: b.titulo || b.code || 'Bloque',
    code: b.code || null,
    orden: typeof b.orden === 'number' ? b.orden : null,
  }));

  return { items };
}

/* =======================
   Rutas con prefijo /api
   ======================= */

/**
 * GET /api/:subject/route/blocks
 *  - :subject puede ser el slug ("aserv") o directamente un subject_id (UUID).
 */
router.get('/api/:subject/route/blocks', async (req, res) => {
  try {
    const subjectKey = String(req.params.subject || '').trim();
    const out = await fetchBlocksBySubjectKey(subjectKey);
    if (out.errorMessage) return res.status(404).json({ error: out.errorMessage });
    return res.json({ items: out.items });
  } catch (e) {
    console.error('[GET /api/:subject/route/blocks] error', e);
    return res.status(500).json({ error: 'Error inesperado' });
  }
});

/**
 * GET /api/blocks?subject=aserv  (slug o UUID)
 */
router.get('/api/blocks', async (req, res) => {
  try {
    const subjectKey = String(req.query.subject || '').trim();
    const out = await fetchBlocksBySubjectKey(subjectKey);
    if (out.errorMessage) return res.status(404).json({ error: out.errorMessage });
    return res.json({ items: out.items });
  } catch (e) {
    console.error('[GET /api/blocks] error', e);
    return res.status(500).json({ error: 'Error inesperado' });
  }
});

/* =======================
   Alias sin prefijo /api
   (para compat con front viejo)
   ======================= */

/**
 * GET /:subject/route/blocks
 */
router.get('/:subject/route/blocks', async (req, res) => {
  try {
    const subjectKey = String(req.params.subject || '').trim();
    const out = await fetchBlocksBySubjectKey(subjectKey);
    if (out.errorMessage) return res.status(404).json({ error: out.errorMessage });
    return res.json({ items: out.items });
  } catch (e) {
    console.error('[GET /:subject/route/blocks] error', e);
    return res.status(500).json({ error: 'Error inesperado' });
  }
});

/**
 * GET /blocks?subject=ed1
 */
router.get('/blocks', async (req, res) => {
  try {
    const subjectKey = String(req.query.subject || '').trim();
    const out = await fetchBlocksBySubjectKey(subjectKey);
    if (out.errorMessage) return res.status(404).json({ error: out.errorMessage });
    return res.json({ items: out.items });
  } catch (e) {
    console.error('[GET /blocks] error', e);
    return res.status(500).json({ error: 'Error inesperado' });
  }
});

module.exports = router;
