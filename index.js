// index.js
require('dotenv').config();

const express = require('express');
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
const rateLimit = require('express-rate-limit');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

/* =======================
   Middlewares globales
   ======================= */
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  })
);
app.use(express.json());

/* =======================
   Rutas
   ======================= */

// CRUD de apuntes
app.use('/apuntes', require('./routes/apuntes'));

// Autenticación (usuarios, perfiles, JWT)
app.use('/auth', require('./routes/auth'));

// Pre-evaluación / Ruta de aprendizaje ED I (ruta específica existente)
app.use('/api/ed1', require('./routes/route-ed1'));

// 🔥 Router genérico por materia (usa :subject = slug de subjects)
app.use('/api/:subject', require('./routes/route-subject'));

/* =======================
   Healthcheck y raíz
   ======================= */
app.get('/', (req, res) => {
  res.send('🎓 CUCEIShare API funcionando');
});

app.get('/healthz', (_req, res) => {
  res.json({ ok: true, env: process.env.NODE_ENV || 'development' });
});

/* =======================
   Manejo de errores
   ======================= */
app.use((req, res, next) => {
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
