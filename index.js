// index.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

/* =======================
   Middlewares globales
   ======================= */

app.set('trust proxy', 1); // opcional, útil si estás detrás de un proxy

// CORS (ajusta el origen si hace falta)
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  })
);

// Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
   404 (después de TODAS las rutas)
   ======================= */
app.use((req, _res, next) => {
  const err = new Error(`No encontrado: ${req.method} ${req.originalUrl}`);
  err.status = 404;
  next(err);
});

/* =======================
   Handler de errores (último middleware)
   ======================= */
app.use((err, _req, res, _next) => {
  // Si ya se enviaron los headers, no intentes responder otra vez
  if (res.headersSent || res.writableEnded) {
    console.error('[post-response error]', err);
    return;
  }

  const status = err.status || 500;

  // Log más ruidoso si es 5xx
  if (status >= 500) {
    console.error(err);
  } else {
    console.warn(err.message);
  }

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

// (Opcional) logs de promesas no manejadas para depurar
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});
