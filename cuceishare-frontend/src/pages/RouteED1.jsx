// src/pages/RouteED1.jsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

const API =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3001';

const cx = (...xs) => xs.filter(Boolean).join(' ');

function Stat({ label, value, sub }) {
  return (
    <div className="rounded-2xl border bg-white shadow-sm p-4">
      <div className="text-3xl font-extrabold">{value}</div>
      <div className="text-slate-600">{label}</div>
      {sub ? <div className="text-xs text-slate-500 mt-1">{sub}</div> : null}
    </div>
  );
}

export default function RouteED1() {
  const navigate = useNavigate();

  // Sesión
  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('usuario') || 'null'); } catch { return null; }
  }, []);
  const token = useMemo(() => localStorage.getItem('token') || '', []);
  const isAuthed = !!user && !!token;

  // Estado
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [summary, setSummary] = useState([]); // /route/summary → [{block_id, total_option, correct_option}]
  const [totals, setTotals] = useState({ total: 0, correct: 0, pct: 0 }); // /results/me
  const [byDiff, setByDiff] = useState([]); // /results/me byDifficulty opcional

  // Redirección si no hay sesión
  useEffect(() => {
    if (!isAuthed) navigate('/login', { replace: true });
  }, [isAuthed, navigate]);

  // Carga resultados de la última sesión
  useEffect(() => {
    let alive = true;
    if (!isAuthed) return;

    (async () => {
      setLoading(true); setErr('');
      try {
        const headers = { Authorization: `Bearer ${token}` };

        const [sumRes, resMe] = await Promise.all([
          axios.get(`${API}/api/ed1/route/summary`, { headers, params: { _t: Date.now() } }),
          axios.get(`${API}/api/ed1/results/me`,    { headers, params: { _t: Date.now() } }),
        ]);

        if (!alive) return;

        setSessionId(sumRes.data?.sessionId || resMe.data?.sessionId || null);
        setSummary(sumRes.data?.blocks || []);
        setTotals(resMe.data?.totals || { total: 0, correct: 0, pct: 0 });
        setByDiff(resMe.data?.byDifficulty || []);
      } catch (e) {
        if (!alive) return;
        if (e?.response?.status === 401) { navigate('/login', { replace: true }); return; }
        setErr(e?.response?.data?.error || 'No se pudo cargar tu ruta');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [isAuthed, token, navigate]);

  // Derivados
  const incorrect = Math.max(0, (totals.total || 0) - (totals.correct || 0));
  const hasResults = (totals.total || 0) > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {/* App Bar */}
      <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="inline-grid place-items-center h-9 w-9 rounded-lg bg-emerald-600/10 text-emerald-700">🗺️</span>
            <div className="truncate">
              <nav className="text-xs text-slate-500" aria-label="Breadcrumb">
                <ol className="flex items-center gap-1">
                  <li className="hover:text-slate-700 cursor-default">Aprendizaje</li>
                  <li className="text-slate-400">/</li>
                  <li className="hover:text-slate-700 cursor-default">ED I</li>
                  <li className="text-slate-400">/</li>
                  <li className="text-slate-700 font-medium truncate">Mi ruta</li>
                </ol>
              </nav>
              <h1 className="text-lg md:text-xl font-bold tracking-tight text-slate-900">
                Ruta de aprendizaje — <span className="text-emerald-700">Estructuras de Datos I</span>
              </h1>
              {user?.id && <p className="text-[11px] text-slate-500">Usuario: <span className="font-mono">#{user.id}</span></p>}
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2">
            <Link
              to="/pre-eval/ed1"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm shadow-sm"
            >
              📊 Ir a la pre-evaluación
            </Link>
            <Link
              to="/buscar"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border hover:bg-slate-50 text-slate-800 text-sm shadow-sm"
            >
              🔎 Explorar apuntes
            </Link>
          </div>
        </div>
      </header>

      {/* Contenido */}
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Estados */}
        {loading && (
          <div className="grid md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl border bg-white p-4 animate-pulse">
                <div className="h-8 w-24 bg-slate-200 rounded mb-2" />
                <div className="h-4 w-32 bg-slate-200 rounded" />
              </div>
            ))}
            <div className="rounded-2xl border bg-white p-6 md:col-span-3">
              <div className="h-5 w-40 bg-slate-200 rounded mb-3" />
              <div className="h-3 w-full bg-slate-200 rounded mb-2" />
              <div className="h-3 w-4/5 bg-slate-200 rounded mb-2" />
              <div className="h-3 w-3/5 bg-slate-200 rounded" />
            </div>
          </div>
        )}

        {err && !loading && (
          <div className="p-4 rounded-xl bg-rose-50 border text-rose-700">
            ⚠️ {err}
            <button
              onClick={() => window.location.reload()}
              className="ml-3 px-3 py-1.5 rounded-lg bg-white border hover:bg-slate-50"
            >
              Reintentar
            </button>
          </div>
        )}

        {!loading && !err && (
          <>
            {/* Resumen superior */}
            <section className="grid md:grid-cols-3 gap-4">
              <Stat label="Preguntas respondidas" value={totals.total || 0} />
              <Stat label="Correctas" value={totals.correct || 0} sub={`${totals.pct || 0}%`} />
              <Stat label="Incorrectas / abiertas" value={incorrect} />
            </section>

            {/* Sugerencia si no hay resultados */}
            {!hasResults && (
              <div className="rounded-2xl border bg-white shadow-sm p-5">
                <div className="text-lg font-bold mb-1">Aún no tienes resultados para ED I</div>
                <p className="text-slate-600 mb-3">
                  Realiza la <span className="font-semibold">pre-evaluación</span> para generar tu ruta de estudio.
                </p>
                <div className="flex gap-2">
                  <Link
                    to="/pre-eval/ed1"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    📊 Empezar pre-evaluación
                  </Link>
                  <Link
                    to="/buscar"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border hover:bg-slate-50"
                  >
                    🔎 Explorar apuntes
                  </Link>
                </div>
              </div>
            )}

            {/* Por dificultad (si viene) */}
            {!!byDiff?.length && (
              <section className="rounded-2xl border bg-white shadow-sm p-5">
                <h2 className="text-lg font-bold mb-3">Desempeño por dificultad</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {byDiff.map((d, i) => (
                    <div key={i} className="rounded-xl border p-4">
                      <div className="text-sm text-slate-500">Dificultad</div>
                      <div className="text-xl font-extrabold">{d.dificultad ?? 'N/D'}</div>
                      <div className="text-sm mt-1">
                        {d.correctas}/{d.total} correctas • {Number(d.porcentaje || 0)}%
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Por bloques (resumen de ruta) */}
            <section className="rounded-2xl border bg-white shadow-sm p-5">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="text-lg font-bold">Progreso por bloques</h2>
                <div className="text-xs text-slate-500">
                  {sessionId ? <>Última sesión: <span className="font-mono">{String(sessionId).slice(0, 8)}…</span></> : 'Sin sesión'}
                </div>
              </div>

              {!summary.length ? (
                <div className="text-slate-600">Aún no hay datos de bloques. Responde la pre-evaluación para ver tu ruta.</div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {summary.map((b, i) => {
                    const total = Number(b.total_option || 0);
                    const correct = Number(b.correct_option || 0);
                    const pct = total ? Math.round((correct / total) * 100) : 0;
                    return (
                      <div key={b.block_id || i} className="rounded-xl border p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="inline-flex items-center gap-2">
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 text-xs">
                              {i + 1}
                            </span>
                            <div className="font-semibold">Bloque {i + 1}</div>
                          </div>
                          <div className="text-sm text-slate-600">{correct}/{total} correctas</div>
                        </div>
                        <div className="h-2 rounded bg-slate-200 overflow-hidden">
                          <div
                            className={cx('h-2 rounded transition-[width] duration-500', pct >= 60 ? 'bg-emerald-600' : 'bg-amber-500')}
                            style={{ width: `${pct}%` }}
                            aria-label={`Progreso ${pct}%`}
                          />
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1">{pct}%</div>

                        {/* Recomendaciones básicas */}
                        <div className="mt-3 text-sm">
                          {pct >= 80 ? (
                            <div className="text-emerald-700">✔️ Bien dominado. Repasa ejercicios de refuerzo.</div>
                          ) : pct >= 50 ? (
                            <div className="text-amber-700">🟡 Intermedio. Revisa apuntes clave y practica más preguntas.</div>
                          ) : (
                            <div className="text-rose-700">🔴 Débil. Empieza por los apuntes introductorios de este bloque.</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Acciones finales */}
            <section className="flex flex-wrap items-center gap-2">
              <Link
                to="/pre-eval/ed1"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                📊 Abrir pre-evaluación
              </Link>
              <Link
                to="/buscar"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border hover:bg-slate-50"
              >
                🔎 Buscar apuntes
              </Link>
              <Link
                to="/"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border hover:bg-slate-50"
              >
                🏠 Ir al inicio
              </Link>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
