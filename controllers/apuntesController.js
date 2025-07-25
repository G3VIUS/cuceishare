// controllers/apuntesController.js

const pool = require('../db');

// GET /apuntes — devuelve todos los apuntes
const getApuntes = async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, titulo, descripcion, autor FROM public.apuntes ORDER BY id'
    );
    res.json(rows);
  } catch (error) {
    console.error('Error al leer apuntes:', error);
    res.status(500).json({ error: 'Error interno al leer apuntes' });
  }
};

// GET /apuntes/:id — devuelve un apunte por su ID
const getApunteById = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      'SELECT id, titulo, descripcion, autor FROM public.apuntes WHERE id = $1',
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Apunte no encontrado' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Error al leer apunte:', error);
    res.status(500).json({ error: 'Error interno al leer apunte' });
  }
};

// POST /apuntes — crea un nuevo apunte
const addApunte = async (req, res) => {
  const { titulo, descripcion, autor } = req.body;
  if (!titulo || !descripcion || !autor) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO public.apuntes (titulo, descripcion, autor)
       VALUES ($1, $2, $3)
       RETURNING id, titulo, descripcion, autor`,
      [titulo, descripcion, autor]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error al guardar apunte:', error);
    res.status(500).json({ error: 'Error interno al guardar apunte' });
  }
};

// DELETE /apuntes/:id — elimina un apunte si el header x-user coincide con el autor
const deleteApunte = async (req, res) => {
  const { id } = req.params;
  const usuario = req.header('x-user');

  if (!usuario) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  try {
    // 1) Obtener autor del apunte
    const { rows } = await pool.query(
      'SELECT autor FROM public.apuntes WHERE id = $1',
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Apunte no encontrado' });
    }
    const { autor } = rows[0];

    // 2) Verificar permisos
    if (autor !== usuario) {
      return res.status(403).json({ error: 'No tienes permiso para borrar este apunte' });
    }

    // 3) Ejecutar borrado
    await pool.query('DELETE FROM public.apuntes WHERE id = $1', [id]);
    res.json({ message: 'Apunte eliminado' });
  } catch (error) {
    console.error('Error al borrar apunte:', error);
    res.status(500).json({ error: 'Error interno al borrar apunte' });
  }
};

module.exports = {
  getApuntes,
  getApunteById,
  addApunte,
  deleteApunte,
};
