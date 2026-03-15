// routes/clasificacion.js
// Guarda y consulta resultados de clasificación IA para apuntes
// (tabla separada: apuntes_clasificaciones — no modifica la tabla apuntes)
const express = require('express');
const { getSupabase } = require('../supabase');
const { authenticate } = require('../middleware/auth');

const router = express.Router({ mergeParams: true }); // hereda :id del montaje

/**
 * POST /apuntes/:id/clasificacion
 * Body: { resultado, confianza, todas_las_probabilidades }
 * Guarda (upsert) el resultado de la IA para este apunte.
 * Requiere auth.
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const supabase = getSupabase();
    const apunteId = Number(req.params.id);
    if (!Number.isInteger(apunteId) || apunteId <= 0) {
      return res.status(400).json({ error: 'ID de apunte inválido' });
    }

    const { resultado, confianza, todas_las_probabilidades } = req.body;
    if (!resultado) {
      return res.status(400).json({ error: 'El campo "resultado" es requerido' });
    }

    // Upsert en la tabla apuntes_clasificaciones
    const { error } = await supabase
      .from('apuntes_clasificaciones')
      .upsert(
        {
          apunte_id: apunteId,
          resultado: String(resultado),
          confianza: typeof confianza === 'number' ? confianza : null,
          todas_las_probabilidades: todas_las_probabilidades ?? null,
          clasificado_en: new Date().toISOString(),
        },
        { onConflict: 'apunte_id' }
      );

    if (error) {
      console.error('[POST clasificacion] error upsert:', error);
      return res.status(500).json({ error: 'Error guardando clasificación', detail: error.message });
    }

    return res.status(201).json({ ok: true, apunte_id: apunteId, resultado });
  } catch (e) {
    console.error('[POST clasificacion] catch:', e);
    return res.status(500).json({ error: 'Error inesperado' });
  }
});

/**
 * GET /apuntes/:id/clasificacion
 * Devuelve el resultado guardado de clasificación para este apunte.
 * Si no existe, 404.
 */
router.get('/', async (req, res) => {
  try {
    const supabase = getSupabase();
    const apunteId = Number(req.params.id);
    if (!Number.isInteger(apunteId) || apunteId <= 0) {
      return res.status(400).json({ error: 'ID de apunte inválido' });
    }

    const { data, error } = await supabase
      .from('apuntes_clasificaciones')
      .select('apunte_id, resultado, confianza, todas_las_probabilidades, clasificado_en')
      .eq('apunte_id', apunteId)
      .maybeSingle();

    if (error) {
      console.error('[GET clasificacion] error:', error);
      return res.status(500).json({ error: 'Error consultando clasificación' });
    }

    if (!data) {
      return res.status(404).json({ clasificacion: null });
    }

    return res.json(data);
  } catch (e) {
    console.error('[GET clasificacion] catch:', e);
    return res.status(500).json({ error: 'Error inesperado' });
  }
});

module.exports = router;
