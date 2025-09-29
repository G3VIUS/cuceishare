// routes/apuntes.js
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const mime = require('mime-types');

const {
  listarApuntes,
  crearApunte,
  obtenerApunte,
  borrarApunte,
  actualizarApunte, // ← IMPORTA AQUÍ UNA SOLA VEZ
} = require('../controllers/apuntesController');

/* ========= Config de subida ========= */
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = mime.extension(file.mimetype) || 'bin';
    const base = path
      .parse(file.originalname || 'archivo')
      .name.replace(/[^a-zA-Z0-9-_]+/g, '_')
      .slice(0, 80) || 'archivo';
    cb(null, `${Date.now()}_${base}.${ext}`);
  },
});

const ACCEPTED = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/png',
  'image/jpeg',
  'text/plain',
]);

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    ACCEPTED.has(file.mimetype) ? cb(null, true) : cb(new Error('Tipo de archivo no permitido')),
});

/* ========= Rutas ========= */
// Listar y obtener
router.get('/', listarApuntes);
router.get('/:id', obtenerApunte);

// Actualizar (persistencia real en BD via controller)
router.put('/:id', actualizarApunte);

// Crear (con o sin archivo)
router.post('/', upload.single('file'), (req, res, next) => {
  if (req.file) {
    req.body = req.body || {};
    req.body.file_path = `/uploads/${req.file.filename}`;
    req.body.file_mime = req.file.mimetype;
    req.body.file_size = req.file.size;
    if (!req.body.resource_url && !req.body.recurso_url) {
      req.body.recurso_url = req.body.file_path;
    }
  }
  return crearApunte(req, res, next);
});

// Subir/actualizar archivo para un apunte existente
router.post('/:id/archivo', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });
  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  const url = `${baseUrl}/uploads/${req.file.filename}`;
  return res.json({ url });
});

// Borrar
router.delete('/:id', borrarApunte);

module.exports = router;
