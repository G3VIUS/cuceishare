// controllers/apuntesController.js
const { pool } = require('../db');

async function getApuntes(req, res) {
  try {
    const { rows } = await pool.query(
      `select id, titulo, descripcion, autor, creado_en
         from apuntes
        order by creado_en desc`
    );
    res.json(rows);
  } catch (e) {
    console.error('Error al leer apuntes:', e);
    res.status(500).json({ error: 'No se pudieron leer los apuntes' });
  }
}

async function getApunte(req, res) {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `select id, titulo, descripcion, autor, creado_en
         from apuntes
        where id = $1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Apunte no encontrado' });
    res.json(rows[0]);
  } catch (e) {
    console.error('Error al leer apunte:', e);
    res.status(500).json({ error: 'No se pudo leer el apunte' });
  }
}

async function crearApunte(req, res) {
  try {
    const { titulo, descripcion, autor } = req.body;
    if (!titulo) return res.status(400).json({ error: 'titulo es requerido' });

    const { rows } = await pool.query(
      `insert into apuntes (titulo, descripcion, autor, creado_en)
       values ($1, $2, $3, now())
       returning id, titulo, descripcion, autor, creado_en`,
      [titulo, descripcion || null, autor || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error('Error al crear apunte:', e);
    res.status(500).json({ error: 'No se pudo crear el apunte' });
  }
}

async function borrarApunte(req, res) {
  try {
    const { id } = req.params;
    const { rowCount } = await pool.query(`delete from apuntes where id=$1`, [id]);
    if (!rowCount) return res.status(404).json({ error: 'Apunte no encontrado' });
    res.json({ ok: true });
  } catch (e) {
    console.error('Error al borrar apunte:', e);
    res.status(500).json({ error: 'No se pudo borrar el apunte' });
  }
}

module.exports = { getApuntes, getApunte, crearApunte, borrarApunte };
