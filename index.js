// index.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

// Si necesitas Supabase aquí:
const { getSupabase } = require('./supabase');

const app = express();
const PORT = process.env.PORT || 3001;

/* =======================
   Middlewares globales
   ======================= */

// Si corres detrás de proxy/reverse-proxy
app.set('trust proxy', 1);

// --- CORS (acepta varios orígenes) ---
const DEFAULT_ORIGINS = ['http://localhost:3000', 'http://localhost:5173'];
const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()).filter(Boolean)
  : DEFAULT_ORIGINS
);

// Valida dinámicamente el Origin para peticiones normales
const corsOptions = {
  origin(origin, cb) {
    // Permite health checks (sin Origin) y los orígenes válidos
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  // No fijamos allowedHeaders para que se reflejen los solicitados en el preflight
};

// **Manejador manual de preflight (OPTIONS) sin registrar path con '*'
//   Evita el crash de path-to-regexp en algunas versiones.
app.use((req, res, next) => {
  if (req.method !== 'OPTIONS') return next();

  const origin = req.headers.origin;
  if (!origin || ALLOWED_ORIGINS.includes(origin)) {
    // Refleja el Origin permitido
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    // Refleja métodos/headers solicitados por el navegador
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    const reqHeaders = req.headers['access-control-request-headers'];
    if (reqHeaders) res.setHeader('Access-Control-Allow-Headers', reqHeaders);
    return res.sendStatus(204);
  }
  // Origin no permitido
  return res.status(403).json({ error: 'CORS: Origin no permitido' });
});

// CORS para el resto de métodos (GET/POST/etc.)
app.use(cors(corsOptions));

// Parsers (JSON y x-www-form-urlencoded)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Archivos estáticos locales (si sirves algo desde /uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/* =======================
   Rutas
   ======================= */

// Apuntes (nota: dentro de routes/apuntes.js usa router.post('/') NO '/apuntes')
app.use('/apuntes', require('./routes/apuntes'));

// Auth (login/register/me)
app.use('/auth', require('./routes/auth'));

// ===== Aprendizaje por materia (routers individuales) =====
app.use('/api/ed1', require('./routes/route-ed1'));
app.use('/api/aserv', require('./routes/route-aserv'));        // Administración de Servidores
app.use('/api/mineria', require('./routes/route-mineria'));    // Minería de Datos
app.use('/api/redes', require('./routes/route-redes'));        // Redes
app.use('/api/algoritmia', require('./routes/route-algoritmia'));
app.use('/api/teoria', require('./routes/route-teoria'));

/* =======================
   Healthcheck y raíz
   ======================= */

app.get('/', (_req, res) => {
  res.send('🎓 CUCEIShare API funcionando');
});

app.get('/healthz', async (_req, res) => {
  try {
    const supabase = getSupabase();
    // consulta mínima para verificar credenciales (no lee datos)
    const { error } = await supabase
      .from('apuntes')
      .select('id', { count: 'exact' })
      .range(0, 0);
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
  console.log(`🔐 CORS_ORIGIN(s): ${ALLOWED_ORIGINS.join(', ')}`);
});

// Debug util de promesas/errores no manejados
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});
