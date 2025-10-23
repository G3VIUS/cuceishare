// routes/admin-contenido.js
const express = require('express');
const { getSupabase } = require('../supabase');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /admin/contenido
 * Lista recursos con filtros y joins a blocks/subjects.
 * Query:
 *  - q: string (busca en title/url/provider)
 *  - subject: slug de materia (opcional)
 *  - block:   id de bloque (uuid, opcional)
 *  - order:   rankDesc | rankAsc | title
 *  - page=1, pageSize=20
 */
router.get(
  '/',
  authenticate,
  authorize(['admin']),
  async (req, res) => {
    const supabase = getSupabase();

    const q        = String(req.query.q || '').trim();
    const subject  = String(req.query.subject || '').trim();
    const block    = String(req.query.block || '').trim();
    const order    = String(req.query.order || 'rankDesc');
    const page     = Math.max(1, parseInt(req.query.page || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || '20', 10)));

    // Base: block_resources con joins para etiquetas de bloque/materia
    let query = supabase
      .from('block_resources')
      .select(`
        id,
        block_id,
        title,
        url,
        rank,
        tipo,
        provider,
        thumb,
        blocks:blocks (
          id,
          subject_id,
          code,
          titulo,
          orden,
          subjects:subjects (
            id,
            slug,
            nombre
          )
        )
      `, { count: 'exact' });

    // Filtros
    if (q) {
      query = query.or([
        `title.ilike.%${q}%`,
        `url.ilike.%${q}%`,
        `provider.ilike.%${q}%`
      ].join(','));
    }
    if (block) {
      query = query.eq('block_id', block);
    }
    // Para filtrar por materia por slug hay que usar el join virtual (no soporta eq directa),
    // así que primero resolvemos el subject_id por slug y luego filtramos por block.subject_id.
    if (subject) {
      const { data: subj, error: eSubj } = await supabase
        .from('subjects')
        .select('id, slug')
        .eq('slug', subject)
        .limit(1)
        .maybeSingle();
      if (eSubj) return res.status(400).json({ error: eSubj.message });
      if (subj?.id) {
        // filtra por block_id IN (select id from blocks where subject_id = subj.id)
        const { data: blocksOfSubject, error: eBlocks } = await supabase
          .from('blocks')
          .select('id')
          .eq('subject_id', subj.id);
        if (eBlocks) return res.status(400).json({ error: eBlocks.message });
        const ids = (blocksOfSubject || []).map(b => b.id);
        if (ids.length === 0) {
          return res.json({ items: [], total: 0, page, pageSize });
        }
        query = query.in('block_id', ids);
      }
    }

    // Orden
    if (order === 'title') {
      query = query.order('title', { ascending: true, nullsFirst: true });
    } else if (order === 'rankAsc') {
      query = query.order('rank', { ascending: true, nullsFirst: true });
    } else {
      // rankDesc (default)
      query = query.order('rank', { ascending: false, nullsFirst: false });
    }

    // Paginación
    const from = (page - 1) * pageSize;
    const to   = from + pageSize - 1;

    const { data, error, count } = await query.range(from, to);
    if (error) return res.status(400).json({ error: error.message });

    // Aplana etiquetas de join para el frontend
    const items = (data || []).map(r => {
      const b = r.blocks || {};
      const s = b.subjects || {};
      return {
        id: r.id,
        block_id: r.block_id,
        title: r.title,
        url: r.url,
        rank: r.rank,
        tipo: r.tipo,
        provider: r.provider,
        thumb: r.thumb,
        subject_id: b.subject_id || null,
        subject_slug: s.slug || null,
        subject_name: s.nombre || null,
        block_title: b.titulo || null,
        block_code: b.code || null,
        block_order: b.orden ?? null,
      };
    });

    res.json({ items, total: count || 0, page, pageSize });
  }
);

/**
 * POST /admin/contenido
 * Body: { block_id, title, url, rank?, tipo?, provider?, thumb? }
 */
router.post(
  '/',
  authenticate,
  authorize(['admin']),
  async (req, res) => {
    const supabase = getSupabase();
    const { block_id, title, url, rank = 0, tipo = null, provider = null, thumb = null } = req.body || {};

    if (!block_id || !title || !url) {
      return res.status(400).json({ error: 'block_id, title y url son requeridos' });
    }

    const { data, error } = await supabase
      .from('block_resources')
      .insert([{ block_id, title, url, rank, tipo, provider, thumb }])
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  }
);

/**
 * PATCH /admin/contenido/:id
 * Body: campos editables (title, url, rank, tipo, provider, thumb, block_id)
 */
router.patch(
  '/:id',
  authenticate,
  authorize(['admin']),
  async (req, res) => {
    const supabase = getSupabase();
    const id = req.params.id;

    const allow = ['title','url','rank','tipo','provider','thumb','block_id'];
    const payload = {};
    for (const k of allow) if (k in req.body) payload[k] = req.body[k];

    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ error: 'Sin cambios' });
    }

    const { data, error } = await supabase
      .from('block_resources')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  }
);

/**
 * DELETE /admin/contenido/:id
 */
router.delete(
  '/:id',
  authenticate,
  authorize(['admin']),
  async (req, res) => {
    const supabase = getSupabase();
    const id = req.params.id;

    const { data, error } = await supabase
      .from('block_resources')
      .delete()
      .eq('id', id)
      .select('id')
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json({ ok: true, deleted: data?.id });
  }
);

/**
 * GET /admin/contenido/catalogs
 * Devuelve materias (deduplicadas por slug) con sus bloques ordenados.
 * Query opcional: ?subject=<slug>
 */
router.get(
  '/catalogs',
  authenticate,
  authorize(['admin']),
  async (req, res) => {
    const supabase = getSupabase();
    const subjectSlug = String(req.query.subject || '').trim();

    // 1) Materias (puede haber duplicadas por datos)
    let sQuery = supabase
      .from('subjects')
      .select('id, slug, nombre')
      .order('nombre', { ascending: true });
    if (subjectSlug) sQuery = sQuery.eq('slug', subjectSlug);

    const { data: rawSubjects, error: sErr } = await sQuery;
    if (sErr) return res.status(400).json({ error: sErr.message });

    // 2) Deduplicar por slug
    const bySlug = new Map();
    (rawSubjects || []).forEach(s => {
      const key = (s.slug || '').toLowerCase();
      if (!bySlug.has(key)) bySlug.set(key, s);
    });
    const subjects = Array.from(bySlug.values());
    if (subjects.length === 0) return res.json({ subjects: [] });

    // 3) Bloques de esos subjects
    const subjectIds = subjects.map(s => s.id);
    const { data: blocks, error: bErr } = await supabase
      .from('blocks')
      .select('id, subject_id, code, titulo, orden')
      .in('subject_id', subjectIds)
      .order('orden', { ascending: true });
    if (bErr) return res.status(400).json({ error: bErr.message });

    // 4) Armar salida
    const out = subjects.map(s => ({
      id: s.id,
      slug: s.slug,
      nombre: s.nombre,
      blocks: (blocks || [])
        .filter(b => b.subject_id === s.id)
        .map(b => ({ id: b.id, code: b.code, titulo: b.titulo, orden: b.orden ?? 0 }))
    }));

    res.json({ subjects: out });
  }
);

module.exports = router;
