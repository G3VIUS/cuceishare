// routes/recursos.js
const router = require('express').Router();
const { pool } = require('../db'); // usa tu pool centralizado

// Healthcheck rápido
router.get('/_ping', (_req, res) => res.json({ ok: true }));

/**
 * GET /recursos
 *   ?materia=ed1|aserv|mineria|redes|algoritmia   -> usa vista recursos_norm (materia_norm)
 *   ?subject_slug=lo-que-venga-en-la-fila         -> compatibilidad con datos crudos
 *   ?subject_id=<uuid>                             -> compatibilidad con datos crudos
 *   ?limit=50
 */
router.get('/', async (req, res) => {
  const { materia, subject_slug, subject_id } = req.query;
  const limit = Math.min(parseInt(req.query.limit || '50', 10) || 50, 200);

  // Debe venir al menos uno
  if (!materia && !subject_slug && !subject_id) {
    return res.status(400).json({ error: 'Falta materia, subject_slug o subject_id' });
  }

  try {
    // 1) Consulta por materia normalizada (recomendado)
    if (materia) {
      const sql = `
        SELECT id, subject_slug, materia_norm, titulo, url, descripcion, tipo, orden, creado_en, activo
        FROM recursos_norm
        WHERE materia_norm = $1 AND activo = TRUE
        ORDER BY orden ASC NULLS LAST, creado_en DESC
        LIMIT $2;
      `;
      const { rows } = await pool.query(sql, [materia, limit]);
      return res.json(rows);
    }

    // 2) Consulta por subject_slug crudo (compatibilidad)
    if (subject_slug) {
      const sql = `
        SELECT id, subject_slug, subject_id, titulo, url, descripcion, tipo, orden, creado_en, activo
        FROM recursos
        WHERE subject_slug = $1 AND activo = TRUE
        ORDER BY orden ASC NULLS LAST, creado_en DESC
        LIMIT $2;
      `;
      const { rows } = await pool.query(sql, [subject_slug, limit]);
      return res.json(rows);
    }

    // 3) Consulta por subject_id crudo (compatibilidad)
    if (subject_id) {
      const sql = `
        SELECT id, subject_slug, subject_id, titulo, url, descripcion, tipo, orden, creado_en, activo
        FROM recursos
        WHERE subject_id = $1 AND activo = TRUE
        ORDER BY orden ASC NULLS LAST, creado_en DESC
        LIMIT $2;
      `;
      const { rows } = await pool.query(sql, [subject_id, limit]);
      return res.json(rows);
    }

    // (No debería llegar aquí)
    return res.status(400).json({ error: 'Parámetros inválidos' });
  } catch (e) {
    console.error('[GET /recursos] error', e);
    return res.status(500).json({ error: 'No se pudieron obtener los recursos' });
  }
});

module.exports = router;

