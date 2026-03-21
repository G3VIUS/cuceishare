// routes/clasificacion.js
// Guarda y consulta resultados de clasificación IA directamente en
// el campo `tags` (jsonb) de la tabla apuntes.
// El resultado IA se guarda como un objeto especial: { "__ia__": true, ... }
// Los tags normales (strings) no se ven afectados.

const express = require('express');
const { getSupabase } = require('../supabase');
const { authenticate } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

const IA_TAG_KEY = '__ia__';

/** Extrae el objeto IA del array de tags. Devuelve undefined si no existe. */
function extraerIaTag(tags) {
  if (!Array.isArray(tags)) return undefined;
  return tags.find(t => t && typeof t === 'object' && t[IA_TAG_KEY] === true);
}

/** Reconstruye el array de tags: quita el anterior IA y pone el nuevo al final. */
function reconstruirTags(tagsActuales, nuevaIA) {
  const sinIA = Array.isArray(tagsActuales)
    ? tagsActuales.filter(t => !(t && typeof t === 'object' && t[IA_TAG_KEY] === true))
    : [];
  return [...sinIA, nuevaIA];
}

/**
 * POST /apuntes/:id/clasificacion
 * Body: { resultado, confianza, todas_las_probabilidades }
 * Agrega (o reemplaza) el objeto IA dentro del campo tags del apunte.
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

    // 1. Leer tags actuales
    const { data: apunte, error: selErr } = await supabase
      .from('apuntes')
      .select('tags')
      .eq('id', apunteId)
      .single();

    if (selErr || !apunte) {
      return res.status(404).json({ error: 'Apunte no encontrado' });
    }

    // 2. Construir nuevo array de tags con el objeto IA
    const iaObj = {
      [IA_TAG_KEY]: true,
      resultado: String(resultado),
      confianza: typeof confianza === 'number' ? confianza : null,
      todas_las_probabilidades: todas_las_probabilidades ?? null,
      clasificado_en: new Date().toISOString(),
    };

    const nuevosTags = reconstruirTags(apunte.tags, iaObj);

    // 3. Actualizar la fila
    const { error: updErr } = await supabase
      .from('apuntes')
      .update({ tags: nuevosTags })
      .eq('id', apunteId);

    if (updErr) {
      console.error('[POST clasificacion] update error:', updErr);
      return res.status(500).json({ error: 'Error guardando clasificación', detail: updErr.message });
    }

    return res.status(201).json({ ok: true, apunte_id: apunteId, resultado });
  } catch (e) {
    console.error('[POST clasificacion] catch:', e);
    return res.status(500).json({ error: 'Error inesperado' });
  }
});

/**
 * GET /apuntes/:id/clasificacion
 * Lee el campo tags del apunte y extrae el objeto IA.
 * 404 si no existe clasificación aún.
 */
router.get('/', async (req, res) => {
  try {
    const supabase = getSupabase();
    const apunteId = Number(req.params.id);
    if (!Number.isInteger(apunteId) || apunteId <= 0) {
      return res.status(400).json({ error: 'ID de apunte inválido' });
    }

    const { data: apunte, error } = await supabase
      .from('apuntes')
      .select('tags')
      .eq('id', apunteId)
      .single();

    if (error || !apunte) {
      return res.status(404).json({ clasificacion: null });
    }

    const iaTag = extraerIaTag(apunte.tags);
    if (!iaTag) {
      return res.status(404).json({ clasificacion: null });
    }

    return res.json({
      apunte_id: apunteId,
      resultado: iaTag.resultado,
      confianza: iaTag.confianza,
      todas_las_probabilidades: iaTag.todas_las_probabilidades,
      clasificado_en: iaTag.clasificado_en,
    });
  } catch (e) {
    console.error('[GET clasificacion] catch:', e);
    return res.status(500).json({ error: 'Error inesperado' });
  }
});

module.exports = router;
