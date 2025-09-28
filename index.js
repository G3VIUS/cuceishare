// index.js
require('dotenv').config();

const express = require('express');
const swaggerUi = require("swagger-ui-express"); // (opcional, no usado abajo)
const swaggerJsdoc = require("swagger-jsdoc");   // (opcional, no usado abajo)
const rateLimit = require('express-rate-limit'); // (opcional, no usado abajo)
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

/* =======================
   Middlewares globales
   ======================= */

// CORS (ajusta el origen si hace falta)
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  })
);

// Parsers
app.use(express.json());                          // JSON
app.use(express.urlencoded({ extended: true }));  // x-www-form-urlencoded

// Estáticos: sirve archivos subidos localmente (para visualizar apuntes)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/* =======================
   Rutas
   ======================= */

// CRUD de apuntes (con soporte de archivo en routes/apuntes.js)
app.use('/apuntes', require('./routes/apuntes'));

// Autenticación (usuarios, perfiles, JWT)
app.use('/auth', require('./routes/auth'));

// Pre-evaluación / Ruta de aprendizaje ED I (legacy / compat)
app.use('/api/ed1', require('./routes/route-ed1'));

// ✅ Router genérico por materia (ej: /api/administracion-servidores/pre-eval)
app.use('/api/:subject', require('./routes/route-subject'));

/* =======================
   Healthcheck y raíz
   ======================= */
app.get('/', (_req, res) => {
  res.send('🎓 CUCEIShare API funcionando');
});

app.get('/healthz', (_req, res) => {
  res.json({ ok: true, env: process.env.NODE_ENV || 'development' });
});

/* =======================
   Manejo de errores
   ======================= */
app.use((req, _res, next) => {
  const err = new Error(`No encontrado: ${req.method} ${req.originalUrl}`);
  err.status = 404;
  next(err);
});

app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  const payload =
    status === 500 && process.env.NODE_ENV === 'production'
      ? { error: 'Error interno del servidor' }
      : { error: err.message || 'Error' };
  res.status(status).json(payload);
});

/* =======================
   Iniciar servidor
   ======================= */
app.listen(PORT, () => {
  console.log(`🚀 Backend listo en http://localhost:${PORT}`);
  console.log(`🔐 CORS_ORIGIN: ${process.env.CORS_ORIGIN || 'http://localhost:3000'}`);
});
