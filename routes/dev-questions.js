const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// GET /api/dev/questions
// Devuelve todo el banco de preguntas con respuestas y contexto
router.get('/', async (req, res) => {
    // Solo permitir en desarrollo (opcional, pero buena práctica)
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: 'Solo disponible en desarrollo' });
    }

    try {
        const query = `
      SELECT
        s.nombre as subject_name,
        s.slug as subject_slug,
        b.titulo as block_title,
        b.code as block_code,
        q.id as question_id,
        q.enunciado as question_text,
        q.tipo as question_type,
        q.dificultad as difficulty,
        (
          SELECT json_agg(json_build_object('text', c.texto, 'is_correct', c.correct))
          FROM choices c
          WHERE c.question_id = q.id
        ) as options,
        (
          SELECT json_agg(k.palabra)
          FROM open_keys k
          WHERE k.question_id = q.id
        ) as open_keys
      FROM questions q
      JOIN blocks b ON q.block_id = b.id
      JOIN subjects s ON b.subject_id = s.id
      ORDER BY s.slug, b.code, q.id;
    `;

        const { rows } = await pool.query(query);

        // Formatear la salida para que sea más limpia si es necesario
        const formatted = rows.map(r => ({
            subject: r.subject_name,
            block: r.block_title,
            question: r.question_text,
            type: r.question_type,
            options: r.options || [],
            // Solo incluir open_keys si existen y es del tipo adecuado, aunque el usuario pidió "todo"
            open_keys: r.open_keys || []
        }));

        res.json(formatted);
    } catch (err) {
        console.error('[DEV /questions] error:', err);
        res.status(500).json({ error: 'Error al obtener el banco de preguntas' });
    }
});

module.exports = router;
