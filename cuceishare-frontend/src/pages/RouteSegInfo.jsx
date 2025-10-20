// src/pages/RouteSegInfo.jsx
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

const TIPO_LABEL = { pdf:'PDF', libro:'Libro', web:'Artículo/Guía', repo:'Repositorio', documento:'Documento' };
const TIPO_ICON  = { pdf:'📄', libro:'📚', web:'🧭', repo:'📦', documento:'📝' };
const TIPO_ORDER = ['pdf','libro','web','repo','documento'];

export default function RouteSegInfo() {
  const navigate = useNavigate();

  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('usuario') || 'null'); } catch { return null; }
  }, []);
  const token = useMemo(() => localStorage.getItem('token') || '', []);
  const isAuthed = !!user && !!token;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [summary, setSummary] = useState([]);
  const [totals, setTotals] = useState({ total: 0, correct: 0, pct: 0 });
  const [byDiff, setByDiff] = useState([]);

  const [openBlock, setOpenBlock] = useState(null);
  const [openBlockTitle, setOpenBlockTitle] = useState('');
  const [resLoading, setResLoading] = useState(false);
  const [resErr, setResErr] = useState('');
  const [resources, setResources] = useState([]);

  useEffect(() => {
    if (!isAuthed) navigate('/login', { replace: true });
  }, [isAuthed, navigate]);

  useEffect(() => {
    let alive = true;
    if (!isAuthed) return;

    (async () => {
      setLoading(true); setErr('');
      try {
        const headers = { Authorization: `Bearer ${token}` };

        const [sumRes, resMe] = await Promise.all([
          axios.get(`${API}/api/seginf/route/summary`, { headers, params: { _t: Date.now() } }),
          axios.get(`${API}/api/seginf/results/me`,    { headers, params: { _t: Date.now() } }),
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

  useEffect(() => {
    let alive = true;
    if (!openBlock) return;
    (async () => {
      setResLoading(true); setResErr(''); setResources([]);
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const { data } = await axios.get(`${API}/api/seginf/route/resources`, {
          headers,
          params: { blockId: openBlock, _t: Date.now() },
        });
        if (!alive) return;
        setResources(Array.isArray(data?.items) ? data.items : []);
      } catch (e) {
        if (!alive) return;
        setResErr(e?.response?.data?.error || 'No se pudieron cargar los recursos');
      } finally {
        if (alive) setResLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [openBlock, token]);

  const groupedResources = useMemo(() => {
    const g = {};
    for (const r of resources) {
      const t = r.tipo || 'documento';
      (g[t] ||= []).push(r);
    }
    for (const k of Object.keys(g)) {
      g[k].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999) || String(a.title).localeCompare(String(b.title)));
    }
    return g;
  }, [resources]);

  const orderedGroups = useMemo(() => {
    const keys = Object.keys(groupedResources);
    return keys.sort((a, b) => {
      const ia = TIPO_ORDER.indexOf(a); const ib = TIPO_ORDER.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  }, [groupedResources]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="inline-grid place-items-center h-9 w-9 rounded-lg bg-emerald-600/10 text-emerald-700">🗺️</span>
            <div className="truncate">
              <nav className="text-xs text-slate-500" aria-label="Breadcrumb">
                <ol className="flex items-center gap-1">
                  <li>Aprendizaje</li><li className="text-slate-400">/</li><li>Seguridad de la Información</li><li className="text-slate-400">/</li><li className="font-medium">Mi ruta</li>
                </ol>
              </nav>
              <h1 className="text-lg md:text-xl font-bold tracking-tight text-slate-900">
                Ruta de aprendizaje — <span className="text-emerald-700">Seguridad de la Información</span>
              </h1>
              {user?.id && <p className="text-[11px] text-slate-500">Usuario: <span className="font-mono">#{user.id}</span></p>}
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2">
            <Link
              to="/pre-eval/seginf"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm shadow-sm"
            >📊 Ir a la pre-evaluación</Link>
            <Link
              to="/buscar?materia=seginf"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border hover:bg-slate-50 text-slate-800 text-sm shadow-sm"
            >🔎 Explorar apuntes</Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {loading && (
          <div className="grid md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2l border bg-white p-4 animate-pulse">
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
            <button onClick={() => window.location.reload()} className="ml-3 px-3 py-1.5 rounded-lg bg-white border hover:bg-slate-50">Reintentar</button>
          </div>
        )}

        {!loading && !err && (
          <>
            <section className="grid md:grid-cols-3 gap-4">
              <Stat label="Preguntas respondidas" value={totals.total || 0} />
              <Stat label="Correctas" value={totals.correct || 0} sub={`${totals.pct || 0}%`} />
              <Stat label="Incorrectas / abiertas" value={Math.max(0, (totals.total || 0) - (totals.correct || 0))} />
            </section>

            {!(totals.total > 0) && (
              <div className="rounded-2xl border bg-white shadow-sm p-5">
                <div className="text-lg font-bold mb-1">Aún no tienes resultados</div>
                <p className="text-slate-600 mb-3">Realiza la <span className="font-semibold">pre-evaluación</span> para generar tu ruta de estudio.</p>
                <div className="flex gap-2">
                  <Link to="/pre-eval/seginf" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white">📊 Empezar pre-evaluación</Link>
                  <Link to="/buscar?materia=seginf" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border hover:bg-slate-50">🔎 Explorar apuntes</Link>
                </div>
              </div>
            )}

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
                    const titulo = b.block_title || `Bloque ${i + 1}`;
                    return (
                      <div key={b.block_id || i} className="rounded-xl border p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="inline-flex items-center gap-2 min-w-0">
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 text-xs shrink-0">{i + 1}</span>
                            <div className="font-semibold truncate">{titulo}</div>
                          </div>
                          <div className="text-sm text-slate-600">{correct}/{total} correctas</div>
                        </div>
                        <div className="h-2 rounded bg-slate-200 overflow-hidden">
                          <div className={cx('h-2 rounded transition-[width] duration-500', pct >= 60 ? 'bg-emerald-600' : 'bg-amber-500')} style={{ width: `${pct}%` }} />
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1">{pct}%</div>

                        <div className="mt-3">
                          <button
                            onClick={() => { setOpenBlock(b.block_id); setOpenBlockTitle(titulo); }}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border hover:bg-slate-50 text-sm"
                          >📚 Ver recursos</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="flex flex-wrap items-center gap-2">
              <Link to="/pre-eval/seginf" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white">📊 Abrir pre-evaluación</Link>
              <Link to="/buscar?materia=seginf" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border hover:bg-slate-50">🔎 Buscar apuntes</Link>
              <Link to="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border hover:bg-slate-50">🏠 Ir al inicio</Link>
            </section>
          </>
        )}
      </main>

      {openBlock && <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setOpenBlock(null)} aria-hidden="true" />}

      <aside
        className={cx(
          'fixed right-0 top-0 z-50 h-full w-full max-w-xl bg-white shadow-2xl border-l transform transition-transform',
          openBlock ? 'translate-x-0' : 'translate-x-full'
        )}
        role="dialog" aria-modal="true" aria-label="Recursos recomendados"
      >
        <div className="h-full flex flex-col">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="min-w-0">
              <h3 className="font-bold truncate">Recursos — {openBlockTitle || 'Bloque'}</h3>
              <p className="text-xs text-slate-500">Videos excluidos · fuentes en español cuando es posible</p>
            </div>
            <button onClick={() => setOpenBlock(null)} className="px-3 py-1.5 rounded-lg border bg-white hover:bg-slate-50" aria-label="Cerrar">✕</button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {resLoading && <div className="text-slate-600">Cargando recursos…</div>}
            {resErr && <div className="p-3 rounded-xl border bg-rose-50 text-rose-800">{resErr}</div>}
            {!resLoading && !resErr && resources.length === 0 && (
              <div className="rounded-xl border bg-slate-50 text-slate-700 p-4">Aún no hay recursos registrados para este bloque.</div>
            )}
            {!resLoading && !resErr && resources.length > 0 && (
              <div className="space-y-6">
                {orderedGroups.map((tipo) => (
                  <section key={tipo}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{TIPO_ICON[tipo] || '🔗'}</span>
                      <h4 className="font-semibold">{TIPO_LABEL[tipo] || 'Recurso'}</h4>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {groupedResources[tipo].map((r) => (
                        <article key={r.id} className="rounded-xl border bg-white hover:shadow-sm transition-shadow overflow-hidden">
                          {r.thumb ? (
                            <a href={r.url} target="_blank" rel="noreferrer" className="block">
                              <img src={r.thumb} alt="" className="w-full h-32 object-cover"
                                   onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                            </a>
                          ) : null}
                          <div className="p-3">
                            <div className="flex items-start gap-2">
                              <div className="h-8 w-8 rounded-lg bg-slate-100 grid place-items-center text-lg shrink-0">
                                {TIPO_ICON[tipo] || '🔗'}
                              </div>
                              <div className="min-w-0">
                                <a href={r.url} target="_blank" rel="noreferrer" className="font-semibold hover:underline line-clamp-2" title={r.title}>
                                  {r.title}
                                </a>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                                  {r.provider && <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{r.provider}</span>}
                                  <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">{TIPO_LABEL[tipo] || 'Recurso'}</span>
                                  {Number.isFinite(r.rank) && <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">prioridad {r.rank}</span>}
                                </div>
                              </div>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>

          <div className="px-4 py-3 border-t">
            <div className="flex justify-end">
              <button onClick={() => setOpenBlock(null)} className="px-3 py-2 rounded-lg border bg-white hover:bg-slate-50">Cerrar</button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
