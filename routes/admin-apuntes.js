// routes/admin-apuntes.js
const express = require('express');
const { getSupabase } = require('../supabase');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /admin/apuntes
 * Query: q, page=1, pageSize=20, order=recientes|antiguos|titulo
 */
router.get(
  '/',
  authenticate,
  authorize(['admin']),
  async (req, res) => {
    const supabase = getSupabase();
    const q        = String(req.query.q || '').trim();
    const page     = Math.max(1, parseInt(req.query.page || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || '20', 10)));
    const order    = String(req.query.order || 'recientes');

    let query = supabase.from('apuntes').select('*', { count: 'exact' });

    if (q) {
      query = query.or([
        `titulo.ilike.%${q}%`,
        `descripcion.ilike.%${q}%`,
        `autor.ilike.%${q}%`
      ].join(','));
    }

    // Orden seguro (la tabla puede no tener created_at)
    if (order === 'titulo') {
      query = query.order('titulo', { ascending: true, nullsFirst: true });
    } else if (order === 'antiguos') {
      query = query.order('id', { ascending: true });
    } else {
      // recientes
      query = query.order('id', { ascending: false });
    }

    const from = (page - 1) * pageSize;
    const to   = from + pageSize - 1;

    const { data, error, count } = await query.range(from, to);
    if (error) return res.status(400).json({ error: error.message });

    return res.json({ items: data || [], total: count || 0, page, pageSize });
  }
);

/**
 * PATCH /admin/apuntes/:id
 * Body: campos editables (titulo, descripcion, visibilidad, subject_slug, etiquetas/tags, resource_url)
 */
router.patch(
  '/:id',
  authenticate,
  authorize(['admin']),
  async (req, res) => {
    const supabase = getSupabase();
    const id = req.params.id;

    const allow = ['titulo','descripcion','visibilidad','subject_slug','resource_url','tags','etiquetas'];
    const payload = {};
    for (const k of allow) if (k in req.body) payload[k] = req.body[k];

    const { data, error } = await supabase
      .from('apuntes')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.json(data);
  }
);

/**
 * DELETE /admin/apuntes/:id
 */
router.delete(
  '/:id',
  authenticate,
  authorize(['admin']),
  async (req, res) => {
    const supabase = getSupabase();
    const id = req.params.id;

    const { data, error } = await supabase
      .from('apuntes')
      .delete()
      .eq('id', id)
      .select('id')
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.json({ ok: true, deleted: data?.id });
  }
);

module.exports = router;
