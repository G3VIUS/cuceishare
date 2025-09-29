// controllers/apuntesController.js
const path = require('path');
const fs = require('fs');
const { pool } = require('../db');

/* =========================
   Utilidades
   ========================= */
function parseTags(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input.map(String).map(s => s.trim()).filter(Boolean);
  if (typeof input === 'string') {
    const s = input.trim();
    if (!s) return [];
    // intenta JSON
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map(String).map(t => t.trim()).filter(Boolean);
    } catch { /* noop */ }
    // fallback CSV
    return s.split(',').map(t => t.trim()).filter(Boolean);
  }
  return [];
}

function stringifyTags(arr) {
  try { return JSON.stringify(arr || []); } catch { return '[]'; }
}

function mapPublicoToVisibilidad(val) {
  // true -> 'public', false -> 'private', undefined -> null (no cambia)
  if (typeof val === 'boolean') return val ? 'public' : 'private';
  if (val === 'public' || val === 'private') return val;
  return null;
}

function safeParseRow(row) {
  if (!row) return row;
  // Convierte tags a array si vienen como string
  try {
    if (typeof row.tags === 'string') row.tags = JSON.parse(row.tags || '[]');
  } catch {
    row.tags = parseTags(row.tags);
  }
  return row;
}

/* =========================
   GET /apuntes?subject=&q=&page=&limit=
   ========================= */
async function listarApuntes(req, res) {
  try {
    const { subject, q, page = '1', limit = '50' } = req.query || {};
    const p = Math.max(parseInt(page, 10) || 1, 1);
    const l = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);

    const conds = [];
    const params = [];
    if (subject) conds.push(`subject_slug = $${params.push(subject)}`);
    if (q) {
      const like = `%${q}%`;
      conds.push(`(titulo ILIKE $${params.push(like)} OR descripcion ILIKE $${params.push(like)})`);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const sql = `
    SELECT id, titulo, descripcion, autor, subject_slug, visibilidad, tags,
          resource_url, file_path, file_mime, file_size, nivel, creado_en
      FROM apuntes
      ${where}
     ORDER BY COALESCE(creado_en, now()) DESC, id DESC
     LIMIT $${params.push(l)} OFFSET $${params.push((p - 1) * l)}
    `;
    const { rows } = await pool.query(sql, params);
    res.json(rows.map(safeParseRow));
  } catch (e) {
    console.error('Error al leer apuntes:', e);
    res.status(500).json({ error: 'No se pudieron leer los apuntes' });
  }
}

/* =========================
   GET /apuntes/:id
   ========================= */
async function obtenerApunte(req, res) {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT id, titulo, descripcion, autor, subject_slug, visibilidad, tags,
              resource_url, file_path, file_mime, file_size, nivel, creado_en
        FROM apuntes
        WHERE id = $1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Apunte no encontrado' });
    res.json(safeParseRow(rows[0]));
  } catch (e) {
    console.error('Error al leer apunte:', e);
    res.status(500).json({ error: 'No se pudo leer el apunte' });
  }
}



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
      file_size,
      semestre, // del front
    } = body;

    if (!titulo.trim()) return res.status(400).json({ error: 'titulo es requerido' });
    if (!descripcion.trim()) return res.status(400).json({ error: 'descripcion es requerida' });

    const tagsArr  = parseTags(tags);
    const urlFinal = resource_url || file_path || null;
    const nivelNum = (semestre !== undefined && semestre !== null && semestre !== '')
      ? Number(semestre)
      : null;

    const { rows } = await pool.query(
      `INSERT INTO apuntes (
         titulo, descripcion, autor,
         subject_slug, visibilidad, tags,
         resource_url, file_path, file_mime, file_size,
         nivel, creado_en
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now())
       RETURNING id, titulo, descripcion, autor, subject_slug, visibilidad, tags,
                 resource_url, file_path, file_mime, file_size, nivel, creado_en`,
      [
        titulo, descripcion, autor,
        subject_slug, visibilidad, JSON.stringify(tagsArr),
        urlFinal, file_path || null, file_mime || null, file_size || null,
        nivelNum
      ]
    );

    res.status(201).json(safeParseRow(rows[0]));
  } catch (e) {
    console.error('Error al crear apunte:', e);
    res.status(500).json({ error: 'No se pudo crear el apunte' });
  }
}

/* =========================
   PUT /apuntes/:id
   (mapea campos del frontend a columnas reales)
   ========================= */
async function actualizarApunte(req, res) {
  try {
    const id = Number(req.params.id);
    const b  = req.body || {};

    // Mapear campos del front → columnas reales
    const titulo       = b.titulo ?? null;
    const descripcion  = b.descripcion ?? null;
    const subject_slug = b.materia ?? null; // "materia" (front) -> subject_slug (BD)
    const visibilidad  = (typeof b.publico === 'boolean')
      ? (b.publico ? 'public' : 'private')
      : (b.visibilidad ?? null);
    const tagsJson     = JSON.stringify(parseTags(b.etiquetas));
    const resource_url = b.recurso_url ?? null;
    const nivel        = (b.semestre !== undefined && b.semestre !== null && b.semestre !== '')
      ? Number(b.semestre)
      : null; // "semestre" (front) -> nivel (int)

    const { rowCount } = await pool.query(
      `UPDATE apuntes SET
         titulo       = COALESCE($1, titulo),
         descripcion  = COALESCE($2, descripcion),
         subject_slug = COALESCE($3, subject_slug),
         visibilidad  = COALESCE($4, visibilidad),
         tags         = COALESCE($5, tags),
         resource_url = COALESCE($6, resource_url),
         nivel        = COALESCE($7, nivel)
       WHERE id = $8`,
      [titulo, descripcion, subject_slug, visibilidad, tagsJson, resource_url, nivel, id]
    );

    if (!rowCount) return res.status(404).json({ error: `Apunte ${id} no encontrado` });

    const { rows } = await pool.query(
      `SELECT id, titulo, descripcion, autor, subject_slug, visibilidad, tags,
              resource_url, file_path, file_mime, file_size, nivel, creado_en
         FROM apuntes
        WHERE id = $1`,
      [id]
    );

    return res.json({ ok: true, apunte: safeParseRow(rows[0]) });
  } catch (e) {
    console.error('Error al actualizar apunte:', e);
    res.status(500).json({ error: 'No se pudo actualizar el apunte' });
  }
}
/* =========================
   DELETE /apuntes/:id
   ========================= */
async function borrarApunte(req, res) {
  try {
    const { id } = req.params;

    // Toma ruta del archivo (si existe) para intentar borrarlo del disco
    const prev = await pool.query(`SELECT file_path FROM apuntes WHERE id=$1`, [id]);
    const { rowCount } = await pool.query(`DELETE FROM apuntes WHERE id=$1`, [id]);

    if (!rowCount) return res.status(404).json({ error: 'Apunte no encontrado' });

    // Si el archivo es local (/uploads/...), intenta borrarlo
    try {
      const filePath = prev.rows?.[0]?.file_path;
      if (filePath && filePath.startsWith('/uploads/')) {
        // elimina la barra inicial para que path.join no ignore el prefijo
        const abs = path.join(__dirname, '..', filePath.replace(/^[\\/]/, ''));
        fs.unlink(abs, () => {}); // ignora errores si no existe
      }
    } catch { /* noop */ }

    res.json({ ok: true });
  } catch (e) {
    console.error('Error al borrar apunte:', e);
    res.status(500).json({ error: 'No se pudo borrar el apunte' });
  }
}

module.exports = {
  listarApuntes,
  obtenerApunte,
  crearApunte,
  actualizarApunte,
  borrarApunte,
};
