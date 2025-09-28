// src/pages/RouteSubject.jsx
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';

const API =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3001';

const cx = (...xs) => xs.filter(Boolean).join(' ');

export default function RouteSubject() {
  const { subjectSlug } = useParams();                         // p.ej. "administracion-servidores"
  const navigate = useNavigate();

  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('usuario') || 'null'); } catch { return null; }
  }, []);
  const token = useMemo(() => localStorage.getItem('token') || '', []);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [summary, setSummary] = useState({ sessionId: null, blocks: [] });
  const [subjectMeta, setSubjectMeta] = useState({ nombre: '', slug: subjectSlug });

  // Cargar meta básica (nombre) + resumen de ruta
  useEffect(() => {
    if (!token) { navigate('/login', { replace: true }); return; }

    let alive = true;
    (async () => {
      setLoading(true); setErr('');

      try {
        // 1) Trae blocks (para nombre de materia y fallback si no hay summary)
        const pre = await fetch(`${API}/api/${subjectSlug}/pre-eval?_t=${Date.now()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const preJson = await pre.json();
        if (!pre.ok) throw new Error(preJson?.error || 'No se pudo cargar la materia');
        if (alive) setSubjectMeta({ nombre: preJson?.subject?.nombre || subjectSlug, slug: subjectSlug });

        // 2) Trae resumen de ruta (progreso por bloque usando últimos intentos)
        const rs = await fetch(`${API}/api/${subjectSlug}/route/summary?_t=${Date.now()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const rsJson = await rs.json();
        if (!rs.ok) throw new Error(rsJson?.error || 'No se pudo cargar el resumen');
        if (alive) setSummary(rsJson);
      } catch (e) {
        if (alive) setErr(e.message || 'Error cargando la ruta');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [API, subjectSlug, token, navigate]);

  const total = summary.blocks.reduce((acc, b) => acc + Number(b.total_option || 0), 0);
  const correct = summary.blocks.reduce((acc, b) => acc + Number(b.correct_option || 0), 0);
  const pct = total ? Math.round((100 * correct) / total) : 0;

  if (!user || !token) return <div className="p-6 text-center">Redirigiendo…</div>;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {/* App Bar */}
      <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="inline-grid place-items-center h-9 w-9 rounded-lg bg-indigo-600/10 text-indigo-700">🗺️</span>
            <div className="truncate">
              <nav className="text-xs text-slate-500 truncate" aria-label="Breadcrumb">
                <ol className="flex items-center gap-1">
                  <li className="hover:text-slate-700 cursor-default">Aprendizaje</li>
                  <li className="text-slate-400">/</li>
                  <li className="text-slate-700 font-medium truncate">{subjectMeta.nombre || subjectSlug}</li>
                </ol>
              </nav>
              <h1 className="text-lg md:text-xl font-bold tracking-tight text-slate-900">
                Mi ruta — <span className="text-indigo-700">{subjectMeta.nombre || subjectSlug}</span>
              </h1>
              <p className="text-[11px] text-slate-500">Usuario: <span className="font-mono">#{user?.id}</span></p>
            </div>
          </div>

          {/* Acciones */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              to={`/pre-eval/${subjectSlug}`}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm shadow-sm"
            >
              📊 Ir a pre-evaluación
            </Link>
            <Link
              to={`/buscar?subject=${encodeURIComponent(subjectSlug)}`}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm shadow-sm"
            >
              📚 Ver apuntes
            </Link>
          </div>
        </div>
      </header>

      {/* Contenido */}
      <main className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Columna principal */}
        <div>
          {loading ? (
            <div className="space-y-4">
              <div className="h-8 w-64 rounded bg-gray-200 animate-pulse" />
              <div className="grid md:grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="p-5 bg-white rounded-2xl shadow border">
                    <div className="h-5 w-32 mb-3 rounded bg-gray-200 animate-pulse" />
                    <div className="h-2 w-full mb-2 rounded bg-gray-200 animate-pulse" />
                    <div className="h-2 w-4/5 mb-2 rounded bg-gray-200 animate-pulse" />
                    <div className="h-2 w-3/5 rounded bg-gray-200 animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          ) : err ? (
            <div className="p-4 rounded-xl bg-rose-50 border text-rose-700">⚠️ {err}</div>
          ) : !summary.blocks.length ? (
            <div className="p-6 rounded-2xl border bg-white shadow-sm">
              <h2 className="font-bold text-lg mb-1">Aún no tienes progreso</h2>
              <p className="text-slate-600 text-sm">
                Realiza la <Link to={`/pre-eval/${subjectSlug}`} className="text-indigo-600 underline">pre-evaluación</Link> para generar tu ruta.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {summary.blocks.map((b, i) => {
                const total = Number(b.total_option || 0);
                const ok = Number(b.correct_option || 0);
                const pct = total ? Math.round((100 * ok) / total) : 0;
                return (
                  <section key={b.block_id || i} className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                    <div className="px-5 py-4 flex items-center gap-3">
                      <span className="inline-flex items-center justify-center h-6 px-2 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold">
                        Bloque {i + 1}
                      </span>
                      <div className="flex-1">
                        <div className="h-2 bg-slate-200 rounded">
                          <div className="h-2 rounded bg-indigo-600 transition-[width] duration-500" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1">{ok}/{total} ({pct}%) correctas</div>
                      </div>
                      <Link
                        to={`/buscar?subject=${encodeURIComponent(subjectSlug)}&block=${encodeURIComponent(b.block_id || '')}`}
                        className="px-3 py-1.5 rounded-xl border bg-white hover:bg-slate-50 text-slate-700 text-sm"
                      >
                        Ver recursos
                      </Link>
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="lg:sticky lg:top-[64px] h-max space-y-4">
          <div className="rounded-2xl border bg-white shadow-sm p-4">
            <h3 className="font-bold mb-1">Resumen</h3>
            <p className="text-xs text-slate-500 mb-2">
              Última sesión: {summary.sessionId ? <span className="font-mono text-slate-700">{String(summary.sessionId).slice(0,8)}…</span> : '—'}
            </p>
            <div className="mb-2">
              <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                <span>{correct}/{total} correctas</span>
                <span>{pct}%</span>
              </div>
              <div className="h-2 bg-slate-200 rounded">
                <div className="h-2 bg-indigo-600 rounded transition-[width] duration-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 mt-3">
              <Link
                to={`/pre-eval/${subjectSlug}`}
                className="w-full px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm text-center"
              >
                📊 Hacer/continuar pre-evaluación
              </Link>
              <Link
                to={`/buscar?subject=${encodeURIComponent(subjectSlug)}`}
                className="w-full px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm text-center"
              >
                📚 Explorar apuntes
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border bg-white shadow-sm p-4">
            <h3 className="font-bold mb-2">Sugerencias</h3>
            <ul className="text-sm text-slate-600 space-y-1">
              <li>Empieza por bloques con menor porcentaje.</li>
              <li>Refuerza con apuntes y vuelve a intentar.</li>
            </ul>
          </div>
        </aside>
      </main>
    </div>
  );
}
