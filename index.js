// index.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

// ✅ si necesitas usar Supabase en este archivo, el path correcto desde la raíz es:
const { getSupabase } = require('./supabase');

const app = express();
const PORT = process.env.PORT || 3001;

/* =======================
   Middlewares globales
   ======================= */

// Si corres detrás de proxy/reverse-proxy
app.set('trust proxy', 1);

// CORS (ajusta origin si usas otro puerto/host para el frontend)
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Parsers (JSON y x-www-form-urlencoded)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Archivos estáticos locales (si aún sirves algo desde /uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/* =======================
   Rutas
   ======================= */

// ⚠️ Importante: como montamos bajo "/apuntes",
// dentro de routes/apuntes.js debe usarse router.post('/') (NO '/apuntes')
app.use('/apuntes', require('./routes/apuntes'));

// Auth (login/register/me) — tu router actual
app.use('/auth', require('./routes/auth'));

// Rutas legacy o por materia
app.use('/api/ed1', require('./routes/route-ed1'));
app.use('/api/:subject', require('./routes/route-subject')); // si tu router espera :subject

/* =======================
   Healthcheck y raíz
   ======================= */

app.get('/', (_req, res) => {
  res.send('🎓 CUCEIShare API funcionando');
});

app.get('/healthz', async (_req, res) => {
  // Check rápido a Supabase (opcional, no truena si falla)
  try {
    const supabase = getSupabase();
    // consulta mínima para verificar credenciales (no lee datos)
    const { error } = await supabase.from('apuntes').select('id', { count: 'exact' }).range(0, 0);
    if (error) {
      return res.status(200).json({ ok: true, supabase: 'error', detail: error.message });
    }
    return res.json({ ok: true, supabase: 'ok' });
  } catch (e) {
    return res.status(200).json({ ok: true, supabase: 'not-configured', detail: e.message });
  }
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
  if (res.headersSent || res.writableEnded) {
    console.error('[post-response error]', err);
    return;
  }

  const status = err.status || 500;

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

// Debug util de promesas/errores no manejados
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});
