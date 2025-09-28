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
} = require('../controllers/apuntesController');

// === Configuración de subida ===
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = mime.extension(file.mimetype) || 'bin';
    const base = path.parse(file.originalname || 'archivo').name
      .replace(/[^a-zA-Z0-9-_]+/g, '_')
      .slice(0, 80) || 'archivo';
    const name = `${Date.now()}_${base}.${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

// === Rutas ===
router.get('/', listarApuntes);
router.get('/:id', obtenerApunte);

// POST /apuntes
// - Si viene FormData con 'file', multer rellenará req.file y deja campos en req.body
// - Si viene JSON (sin archivo), req.file = undefined y req.body lo parsea express.json()
router.post('/', upload.single('file'), (req, res, next) => {
  if (req.file) {
    req.body = req.body || {};
    req.body.file_path = `/uploads/${req.file.filename}`; // URL pública
    req.body.file_mime = req.file.mimetype;
    req.body.file_size = req.file.size;
    // Si no mandaron resource_url, apuntamos al archivo subido
    if (!req.body.resource_url) req.body.resource_url = req.body.file_path;
  }
  return crearApunte(req, res, next);
});

router.delete('/:id', borrarApunte);

module.exports = router;
