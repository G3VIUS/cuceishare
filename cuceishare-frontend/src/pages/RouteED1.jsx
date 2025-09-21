// src/pages/RouteED1.jsx
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { API_BASE } from '../lib/api';

const cx = (...xs) => xs.filter(Boolean).join(' ');
const Icon = ({ children, className='' }) => (
  <span className={cx('inline-grid place-items-center rounded-lg', className)}>{children}</span>
);
const Skeleton = ({ className='' }) => (
  <div className={cx('animate-pulse bg-gray-200/70 rounded', className)} />
);

export default function RouteED1() {
  const navigate = useNavigate();

  // Sesión (memo una vez)
  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('usuario') || 'null'); } catch { return null; }
  }, []);
  const token = useMemo(() => localStorage.getItem('token') || '', []);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!user || !token) navigate('/login', { replace: true });
  }, [userId, token, navigate]);

  // Estado de datos
  const [loadingTotals, setLoadingTotals] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingBlocks, setLoadingBlocks] = useState(true);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [totals, setTotals] = useState(null);
  const [summary, setSummary] = useState(null);

  // Metadata de bloques (para mostrar nombres amigables)
  const [blockMeta, setBlockMeta] = useState([]); // [{id, titulo}, ...]
  const blockMetaById = useMemo(() => {
    const m = new Map();
    blockMeta.forEach((b, idx) => m.set(String(b.id), { ...b, order: idx + 1 }));
    return m;
  }, [blockMeta]);

  // UI: filtros/orden
  const [priorityFilter, setPriorityFilter] = useState('all'); // all|alta|media|baja
  const [sortBy, setSortBy] = useState('need'); // need|score
  const [reloadKey, setReloadKey] = useState(0);

  // 1) Obtener totales
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingTotals(true); setError('');
      try {
        await api.get('/healthz');
        const { data } = await api.get('/api/ed1/results/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!alive) return;
        setTotals(data?.totals || { total: 0, correct: 0, pct: 0 });
      } catch (e) {
        if (!alive) return;
        const msg = e?.response?.data?.error ||
          (e?.response ? `HTTP ${e.response.status} al obtener resultados` :
           e?.message?.includes('Network') ? `No se pudo conectar a ${API_BASE}` :
           e?.message || 'No se pudieron obtener resultados');
        setError(msg);
        setTotals(null);
      } finally { if (alive) setLoadingTotals(false); }
    })();
    return () => { alive = false; };
  }, [token, reloadKey]);

  // 2) Obtener resumen de ruta
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingSummary(true);
      try {
        const { data } = await api.get('/api/ed1/route/summary', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!alive) return;
        setSummary(data);
        setOk('Resumen actualizado');
        setTimeout(() => setOk(''), 1200);
      } catch (e) {
        if (!alive) return;
        setError(prev => prev || e?.response?.data?.error || e?.message || 'No se pudo obtener el resumen de ruta');
      } finally { if (alive) setLoadingSummary(false); }
    })();
    return () => { alive = false; };
  }, [token, reloadKey]);

  // 3) Obtener metadata de bloques para nombres (reutilizamos la del endpoint de pre-eval)
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingBlocks(true);
      try {
        const { data } = await api.get('/api/ed1/pre-eval', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!alive) return;
        // data.blocks => [{ id, titulo }, ...]
        setBlockMeta(Array.isArray(data?.blocks) ? data.blocks : []);
      } catch (e) {
        if (!alive) return;
        // No es crítico, solo caeremos en fallback de nombres
        console.warn('No se pudo cargar metadata de bloques:', e?.message || e);
      } finally { if (alive) setLoadingBlocks(false); }
    })();
    return () => { alive = false; };
  }, [token]);

  // Normaliza bloques con prioridad y NOMBRES AMIGABLES
  const rawBlocks = useMemo(() => {
    const rows = summary?.blocks || [];
    return rows.map((r, idx) => {
      const totalO = Number(r.total_option || 0);
      const correctO = Number(r.correct_option || 0);
      const total = totalO;
      const pct = total ? Math.round((correctO / total) * 100) : 0;
      let prioridad = 'media';
      if (pct >= 80) prioridad = 'baja';
      else if (pct < 50) prioridad = 'alta';

      const id = String(r.block_id ?? '');
      const meta = blockMetaById.get(id);
      // Prioridad para nombres: meta.titulo > r.title > r.titulo > "Bloque N"
      const displayName =
        meta?.titulo?.trim() ||
        (r.title && String(r.title).trim()) ||
        (r.titulo && String(r.titulo).trim()) ||
        `Bloque ${meta?.order ?? (idx + 1)}`;

      return {
        block_id: id,
        titulo: displayName,
        total,
        correct: correctO,
        pct,
        prioridad,
        order: meta?.order ?? (idx + 1)
      };
    });
  }, [summary, blockMetaById]);

  // Aplicar filtros/orden
  const blocks = useMemo(() => {
    let list = rawBlocks;
    if (priorityFilter !== 'all') list = list.filter(b => b.prioridad === priorityFilter);
    if (sortBy === 'need') {
      list = [...list].sort((a,b) => a.pct - b.pct || a.order - b.order);
    } else {
      list = [...list].sort((a,b) => b.pct - a.pct || a.order - b.order);
    }
    return list;
  }, [rawBlocks, priorityFilter, sortBy]);

  // Helpers UI
  const pctBar = (p) =>
    cx('h-2 rounded', p >= 80 ? 'bg-emerald-600' : p >= 50 ? 'bg-amber-500' : 'bg-rose-600');

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {/* App Bar */}
      <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          {/* Breadcrumb + título */}
          <div className="flex items-center gap-3 min-w-0">
            <Icon className="h-9 w-9 bg-emerald-600/10 text-emerald-700">📈</Icon>
            <div className="truncate">
              <nav className="text-xs text-slate-500 truncate" aria-label="Breadcrumb">
                <ol className="flex items-center gap-1">
                  <li className="hover:text-slate-700 cursor-default">Aprendizaje</li>
                  <li className="text-slate-400">/</li>
                  <li className="hover:text-slate-700 cursor-default">ED I</li>
                  <li className="text-slate-400">/</li>
                  <li className="text-slate-700 font-medium truncate">Mi ruta</li>
                </ol>
              </nav>
              <h1 className="text-lg md:text-xl font-bold tracking-tight text-slate-900">
                Ruta — <span className="text-indigo-700">Estructuras de Datos I</span>
              </h1>
              <p className="text-[11px] text-slate-500">
                Usuario: <span className="font-mono">#{user?.id ?? '—'}</span> • API: <span className="font-mono">{API_BASE}</span>
              </p>
            </div>
          </div>

          {/* Acciones */}
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={() => navigate('/ed1/pre')}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm shadow-sm"
            >
              📝 Pre-evaluación
            </button>
            <Link
              to="/buscar"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm shadow-sm"
            >
              🔎 Apuntes
            </Link>
            <button
              onClick={() => setReloadKey(k => k + 1)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm shadow-sm"
              title="Refrescar"
            >
              🔁 Refrescar
            </button>
          </div>
        </div>
      </header>

      {/* Toasts */}
      <div className="fixed inset-x-0 top-2 z-50 flex flex-col items-center gap-2 px-3">
        {ok && (
          <div className="max-w-md w-full rounded-xl border bg-emerald-50 text-emerald-800 px-3 py-2 shadow">
            ✅ {ok}
          </div>
        )}
        {error && (
          <div className="max-w-md w-full rounded-xl border bg-rose-50 text-rose-800 px-3 py-2 shadow">
            ⚠️ {error}
          </div>
        )}
      </div>

      {/* Contenido */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* KPIs */}
        <section className="grid md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border shadow-sm p-5">
            <div className="text-sm text-slate-500">Preguntas</div>
            <div className="mt-1 text-3xl font-extrabold">
              {loadingTotals ? '—' : totals ? `${totals.total}` : '0'}
            </div>
          </div>
          <div className="bg-white rounded-2xl border shadow-sm p-5">
            <div className="text-sm text-slate-500">Correctas</div>
            <div className="mt-1 text-3xl font-extrabold">
              {loadingTotals ? '—' : totals ? `${totals.correct}` : '0'}
            </div>
          </div>
          <div className="bg-white rounded-2xl border shadow-sm p-5">
            <div className="text-sm text-slate-500">Porcentaje</div>
            <div className="mt-3">
              <div className="h-2 bg-slate-200 rounded overflow-hidden">
                <div
                  className="h-2 rounded bg-indigo-600 transition-[width] duration-500"
                  style={{ width: `${loadingTotals || !totals ? 0 : totals.pct}%` }}
                  aria-label={`Porcentaje ${totals?.pct ?? 0}%`}
                />
              </div>
              <div className="mt-1 text-3xl font-extrabold">
                {loadingTotals ? '—' : totals ? `${totals.pct}%` : '0%'}
              </div>
            </div>
          </div>
        </section>

        {/* Aviso si no hay totales */}
        {!loadingTotals && !totals && (
          <div className="p-4 rounded-xl bg-amber-50 border text-amber-900">
            Aún no hay resultados. Realiza primero la{' '}
            <button onClick={() => navigate('/ed1/pre')} className="underline">pre-evaluación</button>.
          </div>
        )}

        {/* Controles */}
        <section className="bg-white rounded-2xl border shadow-sm p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Filtrar:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="text-sm rounded-lg border px-2 py-1 bg-white"
              aria-label="Filtrar por prioridad"
            >
              <option value="all">Todas</option>
              <option value="alta">Alta prioridad</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Ordenar:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-sm rounded-lg border px-2 py-1 bg-white"
              aria-label="Ordenar por"
            >
              <option value="need">Necesidad (peor → mejor)</option>
              <option value="score">Puntaje (mejor → peor)</option>
            </select>
          </div>
        </section>

        {/* Bloques prioritarios */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold">Bloques prioritarios</h2>

          {loadingSummary || loadingBlocks ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border p-5">
                  <Skeleton className="h-5 w-40 mb-3" />
                  <Skeleton className="h-2 w-full mb-2" />
                  <Skeleton className="h-2 w-4/5 mb-2" />
                  <Skeleton className="h-2 w-3/5" />
                </div>
              ))}
            </div>
          ) : !(summary?.blocks?.length) ? (
            <div className="p-6 rounded-2xl border bg-white shadow-sm text-center">
              <div className="text-4xl mb-2">🧭</div>
              <h3 className="font-bold text-lg">Sin información de ruta</h3>
              <p className="text-slate-600 text-sm">Aún no tenemos datos para recomendarte por bloque.</p>
            </div>
          ) : blocks.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-50 border text-slate-700">
              No hay bloques que coincidan con el filtro seleccionado.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {blocks.map((b) => (
                <div
                  key={b.block_id}
                  className="bg-white rounded-2xl border shadow-sm p-5 flex flex-col gap-3 hover:shadow transition-shadow"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{b.titulo}</h3>
                      <p className="text-xs text-slate-500">Bloque {b.order}</p>
                    </div>
                    <span
                      className={cx(
                        'px-2 py-1 rounded text-xs font-semibold shrink-0 capitalize',
                        b.prioridad === 'alta'
                          ? 'bg-rose-100 text-rose-800'
                          : b.prioridad === 'baja'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-900'
                      )}
                      title={`Prioridad ${b.prioridad}`}
                    >
                      {b.prioridad}
                    </span>
                  </div>

                  <div>
                    <div className="h-2 bg-slate-200 rounded">
                      <div className={pctBar(b.pct)} style={{ width: `${b.pct}%` }} />
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-sm font-bold">{b.pct}%</span>
                      <span className="text-sm text-slate-500">{b.correct}/{b.total}</span>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center gap-2">
                    <Link
                      to="/buscar"
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-white hover:bg-slate-50 text-sm text-slate-700"
                      title="Buscar apuntes relacionados"
                    >
                      📚 Apuntes
                    </Link>
                    <button
                      onClick={() => navigate('/ed1/pre')}
                      className="ml-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm"
                      title="Practicar más"
                    >
                      🧠 Practicar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Footer minimal */}
      <footer className="border-t bg-white/70">
        <div className="max-w-7xl mx-auto px-6 py-3 text-[11px] text-slate-500 flex items-center justify-between">
          <span>Mi ruta — ED I</span>
          <button
            onClick={() => setReloadKey(k => k + 1)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded border bg-white hover:bg-slate-50"
            title="Refrescar datos"
          >
            🔁 Refrescar
          </button>
        </div>
      </footer>
    </div>
  );
}
