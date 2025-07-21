// controllers/apuntesController.js

const fs = require('fs');
const path = require('path');
const apuntes = require('../data/apuntes.json');

// GET - Mostrar todos los apuntes
const getApuntes = (req, res) => {
  res.json(apuntes);
};

// POST - Agregar nuevo apunte
const addApunte = (req, res) => {
  try {
    const { titulo, descripcion, autor } = req.body;
    console.log('Datos recibidos:', req.body); // depuración

    // Validación de campos obligatorios
    if (!titulo || !descripcion || !autor) {
      console.log('Faltan campos obligatorios');
      return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    const nuevoApunte = {
      id: apuntes.length + 1,
      titulo,
      descripcion,
      autor,
    };

    apuntes.push(nuevoApunte);

    // Guardar apuntes actualizados en el archivo JSON
    fs.writeFileSync(
      path.join(__dirname, '../data/apuntes.json'),
      JSON.stringify(apuntes, null, 2)
    );

    console.log('Apunte guardado correctamente');
    res.status(201).json(nuevoApunte);
  } catch (error) {
    console.error('Error al guardar apunte:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  getApuntes,
  addApunte,
};
