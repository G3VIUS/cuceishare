// index.js — CommonJS puro
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

// **Preflight OPTIONS**
app.use((req, res, next) => {
  if (req.method !== 'OPTIONS') return next();

  const origin = req.headers.origin;
  if (!origin || ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    const reqHeaders = req.headers['access-control-request-headers'];
    if (reqHeaders) res.setHeader('Access-Control-Allow-Headers', reqHeaders);
    return res.sendStatus(204);
  }
  return res.status(403).json({ error: 'CORS: Origin no permitido' });
});

// CORS para el resto de métodos
app.use(cors({
  origin(origin, cb) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
}));

// Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Estáticos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/* =======================
   Rutas
   ======================= */

// Apuntes
app.use('/apuntes', require('./routes/apuntes'));

// Auth
app.use('/auth', require('./routes/auth'));

// ===== Aprendizaje por materia =====
app.use('/api/ed1',           require('./routes/route-ed1'));
app.use('/api/aserv',         require('./routes/route-aserv'));        // Administración de Servidores
app.use('/api/mineria',       require('./routes/route-mineria'));      // Minería de Datos
app.use('/api/redes',         require('./routes/route-redes'));        // Redes
app.use('/api/algoritmia',    require('./routes/route-algoritmia'));   // Algoritmia
app.use('/api/teoria',        require('./routes/route-teoria'));       // Teoría de la Computación
app.use('/api/programacion',  require('./routes/route-programacion')); // Programación
app.use('/api/ingsoft',       require('./routes/route-ingsoft'));      // Ingeniería de Software
app.use('/api/seginf',        require('./routes/route-seginf'));

app.use('/admin/apuntes',     require('./routes/admin-apuntes'));
app.use('/admin/contenido',   require('./routes/admin-contenido'));

// ---- Stub opcional para evitar errores del frontend si aún llama /api/ask ----
app.post('/api/ask', (_req, res) => {
  return res.status(503).json({ error: 'Asistente de IA deshabilitado en el servidor.' });
});

/* =======================
   Healthcheck y raíz
   ======================= */

app.get('/', (_req, res) => {
  res.send('🎓 CUCEIShare API funcionando');
});

app.get('/healthz', async (_req, res) => {
  try {
    const supabase = getSupabase();
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
   404
   ======================= */

app.use((req, _res, next) => {
  const err = new Error(`No encontrado: ${req.method} ${req.originalUrl}`);
  err.status = 404;
  next(err);
});

/* =======================
   Handler de errores
   ======================= */

app.use((err, _req, res, _next) => {
  if (res.headersSent || res.writableEnded) {
    console.error('[post-response error]', err);
    return;
  }
  const status = err.status || 500;

  if (status >= 500) console.error(err);
  else console.warn(err.message);

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

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});
