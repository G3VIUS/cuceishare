
const pool = require('../db');

const registUser = async (data) => {
  try {
    const { rows } = await pool.query(
      `INSERT INTO public.usuarios (username, password_hash, ultimo_login, role, creado_en)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [data.username, data.hash, data.lastlogin, data.role, data.createAt]
    );
    return rows[0]; // mejor regresar solo el objeto creado
  } catch (error) {
    throw error; // el controller se encarga de manejarlo
  }
};

const findById = async (id) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, username, password_hash FROM public.usuarios WHERE id = $1',
      [id]
    );
    if (rows.length === 0) {
      return null;
    }
    return rows[0];
  } catch (error) {
    throw error;
  }
};

const findByUsername = async (username) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, username, password_hash FROM public.usuarios WHERE username = $1',
      [username]
    );
    if (rows.length === 0) {
      return null
    }
    return rows[0];
  } catch (error) {
    throw error;
  }
};

module.exports = {
    registUser,
    findById,
    findByUsername
}