// controllers/apuntesController.js
const path = require('path');
const fs = require('fs');
const { pool } = require('../db');

/* Util */
function parseTags(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input.filter(Boolean);
  if (typeof input === 'string') {
    const s = input.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch {
      // CSV fallback
      return s.split(',').map(t => t.trim()).filter(Boolean);
    }
  }
  return [];
}

/* GET /apuntes?subject=slug&q=texto&page=1&limit=20 */
async function listarApuntes(req, res) {
  try {
    const { subject, q, page = '1', limit = '50' } = req.query || {};
    const p = Math.max(parseInt(page, 10) || 1, 1);
    const l = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);

    const conds = [];
    const params = [];
    if (subject) {
      conds.push(`subject_slug = $${params.push(subject)}`);
    }
    if (q) {
      conds.push(`(titulo ILIKE $${params.push(`%${q}%`)} OR descripcion ILIKE $${params.push(`%${q}%`)})`);
    }

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const sql = `
      SELECT id, titulo, descripcion, autor, subject_slug, visibilidad, tags,
             resource_url, file_path, file_mime, file_size, creado_en
        FROM apuntes
        ${where}
       ORDER BY COALESCE(creado_en, now()) DESC, id DESC
       LIMIT $${params.push(l)} OFFSET $${params.push((p-1)*l)}
    `;
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error('Error al leer apuntes:', e);
    res.status(500).json({ error: 'No se pudieron leer los apuntes' });
  }
}

/* GET /apuntes/:id */
async function obtenerApunte(req, res) {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT id, titulo, descripcion, autor, subject_slug, visibilidad, tags,
              resource_url, file_path, file_mime, file_size, creado_en
         FROM apuntes
        WHERE id = $1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Apunte no encontrado' });
    res.json(rows[0]);
  } catch (e) {
    console.error('Error al leer apunte:', e);
    res.status(500).json({ error: 'No se pudo leer el apunte' });
  }
}

/* POST /apuntes  (JSON o multipart/form-data) */
async function crearApunte(req, res) {
  try {
    const body = req.body || {};
    const {
      titulo = '',
      descripcion = '',
      autor = null,
      subject_slug = null,
      visibilidad = 'public',
      tags,
      resource_url,
      file_path,
      file_mime,
      file_size
    } = body;

    if (!titulo.trim()) return res.status(400).json({ error: 'titulo es requerido' });
    if (!descripcion.trim()) return res.status(400).json({ error: 'descripcion es requerida' });

    const tagsArr = parseTags(tags);
    const urlFinal = resource_url || file_path || null;

    const { rows } = await pool.query(
      `INSERT INTO apuntes (
         titulo, descripcion, autor,
         subject_slug, visibilidad, tags,
         resource_url, file_path, file_mime, file_size,
         creado_en
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now())
       RETURNING id, titulo, descripcion, autor, subject_slug, visibilidad, tags,
                 resource_url, file_path, file_mime, file_size, creado_en`,
      [
        titulo, descripcion, autor,
        subject_slug, visibilidad, JSON.stringify(tagsArr),
        urlFinal, file_path || null, file_mime || null, file_size || null
      ]
    );

    res.status(201).json(rows[0]);
  } catch (e) {
    console.error('Error al crear apunte:', e);
    res.status(500).json({ error: 'No se pudo crear el apunte' });
  }
}

/* DELETE /apuntes/:id */
async function borrarApunte(req, res) {
  try {
    const { id } = req.params;

    // Tomamos ruta del archivo (si existe) para intentar borrarlo del disco
    const prev = await pool.query(`SELECT file_path FROM apuntes WHERE id=$1`, [id]);
    const { rowCount } = await pool.query(`DELETE FROM apuntes WHERE id=$1`, [id]);

    if (!rowCount) return res.status(404).json({ error: 'Apunte no encontrado' });

    // Si el archivo es local (/uploads/...), intentamos borrarlo
    try {
      const filePath = prev.rows?.[0]?.file_path;
      if (filePath && filePath.startsWith('/uploads/')) {
        const abs = path.join(__dirname, '..', filePath);
        fs.unlink(abs, () => {}); // no rompas si no existe
      }
    } catch {}

    res.json({ ok: true });
  } catch (e) {
    console.error('Error al borrar apunte:', e);
    res.status(500).json({ error: 'No se pudo borrar el apunte' });
  }
}

module.exports = { listarApuntes, obtenerApunte, crearApunte, borrarApunte };
