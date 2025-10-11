// src/pages/RouteGeneric.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:3001';

function useToken() {
  return localStorage.getItem('token');
}

async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText} — ${txt || 'Error'}`);
  }
  return res.json();
}

function niceTitle(slug) {
  return (slug || '')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function pct(correct, total) {
  if (!total) return 0;
  return Math.round((correct / total) * 100);
}

function Bar({ value }) {
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <div className="h-2 w-full rounded bg-gray-200">
      <div
        className="h-2 rounded bg-indigo-500 transition-all"
        style={{ width: `${v}%` }}
        aria-label={`progreso ${v}%`}
      />
    </div>
  );
}

function AccuracyPill({ correct, total }) {
  const p = pct(correct, total);
  const color =
    total === 0 ? 'bg-gray-200 text-gray-700' :
    p >= 80 ? 'bg-green-100 text-green-700' :
    p >= 50 ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700';
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full ${color}`}>
      {total === 0 ? 's/a' : `${p}%`}
    </span>
  );
}

function SkeletonLine({ className = '' }) {
  return <div className={`animate-pulse bg-gray-200 h-4 rounded ${className}`} />;
}

export default function RouteGeneric() {
  const { subjectSlug } = useParams();
  const navigate = useNavigate();
  const token = useToken();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // Resumen global
  const [sessionId, setSessionId] = useState(null);
  const [blocks, setBlocks] = useState([]); // {block_id, block_title, block_code, block_order, total_option, correct_option}
  const [totals, setTotals] = useState({ total: 0, correct: 0, pct: 0 });

  // Selección + tabs
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [activeTab, setActiveTab] = useState('resumen'); // 'resumen' | 'material' | 'recom'

  // Detalle de bloque (Resumen)
  const [blockDetail, setBlockDetail] = useState({ loading: false, items: [], error: '' });

  // Material del bloque
  const [materials, setMaterials] = useState({ loading: false, data: null, error: '' });
  const [showMoreApuntes, setShowMoreApuntes] = useState(false);

  // Recomendaciones
  const [recs, setRecs] = useState({ loading: false, items: [], error: '' });

  const authHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }),
    [token]
  );

  const subjectTitle = useMemo(() => niceTitle(subjectSlug), [subjectSlug]);

  // ------- Inicial: resumen global y totales -------
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setErr('');

    (async () => {
      try {
        const [summary, me] = await Promise.all([
          fetchJSON(`${API_BASE}/api/${subjectSlug}/route/summary`, { headers: authHeaders }),
          fetchJSON(`${API_BASE}/api/${subjectSlug}/results/me`, { headers: authHeaders }),
        ]);

        if (!mounted) return;

        setSessionId(summary.sessionId || null);
        setBlocks(summary.blocks || []);
        setTotals(me?.totals || { total: 0, correct: 0, pct: 0 });

        // Bloque por defecto: el más débil
        const decorated = (summary.blocks || []).map(b => ({
          ...b,
          _pct: pct(Number(b.correct_option || 0), Number(b.total_option || 0)),
        }));
        decorated.sort((a, b) => (a._pct - b._pct) || ((a.block_order ?? 0) - (b.block_order ?? 0)));
        const def = decorated[0] || null;
        setSelectedBlock(def?.block_id || null);
      } catch (e) {
        console.error(e);
        setErr(e.message || 'No se pudo cargar la ruta');
      } finally {
        mounted && setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [subjectSlug, authHeaders]);

  // ------- Detalle por bloque (Resumen) -------
  useEffect(() => {
    if (!selectedBlock || activeTab !== 'resumen') return;
    let mounted = true;
    setBlockDetail(s => ({ ...s, loading: true, error: '' }));

    fetchJSON(`${API_BASE}/api/${subjectSlug}/route/block/${selectedBlock}`, { headers: authHeaders })
      .then((data) => {
        if (!mounted) return;
        setBlockDetail({ loading: false, items: data.topics || [], error: '' });
      })
      .catch((e) => {
        if (!mounted) return;
        setBlockDetail({ loading: false, items: [], error: e.message || 'Error' });
      });

    return () => { mounted = false; };
  }, [selectedBlock, activeTab, subjectSlug, authHeaders]);

  // ------- Material del bloque -------
  useEffect(() => {
    if (!selectedBlock || activeTab !== 'material') return;
    let mounted = true;
    setMaterials({ loading: true, data: null, error: '' });
    setShowMoreApuntes(false);

    fetchJSON(`${API_BASE}/api/${subjectSlug}/materials/block/${selectedBlock}`, { headers: authHeaders })
      .then((data) => {
        if (!mounted) return;
        setMaterials({ loading: false, data, error: '' });
      })
      .catch((e) => {
        if (!mounted) return;
        setMaterials({ loading: false, data: null, error: e.message || 'Error' });
      });

    return () => { mounted = false; };
  }, [selectedBlock, activeTab, subjectSlug, authHeaders]);

  // ------- Recomendaciones -------
  useEffect(() => {
    if (activeTab !== 'recom') return;
    let mounted = true;
    setRecs(s => ({ ...s, loading: true, error: '' }));

    fetchJSON(`${API_BASE}/api/${subjectSlug}/route/recommendations`, { headers: authHeaders })
      .then((data) => {
        if (!mounted) return;
        setRecs({ loading: false, items: data.topics || [], error: '' });
      })
      .catch((e) => {
        if (!mounted) return;
        setRecs({ loading: false, items: [], error: e.message || 'Error' });
      });

    return () => { mounted = false; };
  }, [activeTab, subjectSlug, authHeaders]);

  function blockById(id) {
    return blocks.find(b => b.block_id === id);
  }
  const selectedBlockMeta = blockById(selectedBlock);
  const sbCorrect = Number(selectedBlockMeta?.correct_option || 0);
  const sbTotal   = Number(selectedBlockMeta?.total_option || 0);
  const sbPct     = pct(sbCorrect, sbTotal);

  // Agrupar archivos por apunte (si existen)
  const archivosByApunte = useMemo(() => {
    const m = new Map();
    const arr = materials?.data?.materials?.archivos || [];
    for (const f of arr) {
      const k = f.apunte_id;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(f);
    }
    return m;
  }, [materials]);

  function apunteFilesCount(apunteId) {
    return archivosByApunte.get(apunteId)?.length || 0;
  }

  function fileUrl(f) {
    if (!f) return null;
    const n = f.filename || f.path || '';
    if (!n) return null;
    if (/^https?:\/\//i.test(n)) return n;
    const rel = n.startsWith('/') ? n : `/uploads/${n}`;
    return `${API_BASE}${rel}`;
  }

  function openResource(ap) {
    if (ap?.resource_url) {
      window.open(ap.resource_url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (ap?.file_path) {
      const path = ap.file_path.startsWith('/') ? ap.file_path : `/${ap.file_path}`;
      window.open(`${API_BASE}${path}`, '_blank', 'noopener,noreferrer');
      return;
    }
    // Si no hay resource_url ni file_path, intenta primer archivo ligado
    const first = (archivosByApunte.get(ap.id) || [])[0];
    const url = fileUrl(first);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function startPracticeForBlocks(blockIds, count = 10) {
    try {
      const body = JSON.stringify({ sessionId, topics: blockIds, count });
      const data = await fetchJSON(`${API_BASE}/api/${subjectSlug}/route/practice`, {
        method: 'POST',
        headers: authHeaders,
        body
      });
      if (data?.quizPath) {
        navigate(data.quizPath);
      } else if (data?.practiceSessionId && data?.questionIds?.length) {
        const idsCsv = data.questionIds.join(',');
        navigate(`/practice/${subjectSlug}?sid=${data.practiceSessionId}&q=${idsCsv}`);
      } else {
        alert('No se pudo iniciar la práctica (respuesta vacía).');
      }
    } catch (e) {
      console.error(e);
      alert(e.message || 'No se pudo iniciar la práctica');
    }
  }

  async function startAdaptive() {
    const scored = (blocks || []).map(b => ({
      ...b,
      _pct: pct(Number(b.correct_option || 0), Number(b.total_option || 0)),
    }));
    scored.sort((a, b) => (a._pct - b._pct));
    const candidates = scored.filter(b => Number(b.total_option || 0) > 0);
    const pick = (candidates.length ? candidates : scored).slice(0, 3).map(b => b.block_id);
    await startPracticeForBlocks(pick, 10);
  }

  async function practiceSelectedBlock() {
    if (!selectedBlock) return;
    await startPracticeForBlocks([selectedBlock], 8);
  }

  // ======= UI =======
  return (
    <div className="max-w-7xl mx-auto">
      {/* Encabezado */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold">{subjectTitle}</h1>
          <p className="text-sm text-gray-600">
            Ruta personalizada{' '}
            {sessionId ? <span className="text-gray-500">• sesión {String(sessionId).slice(0, 8)}…</span> : null}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={startAdaptive}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
            title="Crea una práctica con tus 2–3 bloques más débiles"
          >
            🧠 Practicar mis debilidades
          </button>
          <button
            onClick={practiceSelectedBlock}
            disabled={!selectedBlock}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-gray-900 text-white disabled:opacity-40"
            title="Genera preguntas del bloque seleccionado"
          >
            📝 Practicar bloque
          </button>
        </div>
      </div>

      {/* KPI: Global + Bloque */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-2">
        <div className="p-3 border rounded-lg md:col-span-2">
          <div className="flex items-center justify-between">
            <div className="font-medium">Tu desempeño global</div>
            <div className="text-xs text-gray-500">basado en última sesión</div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-2">
            <div className="p-2 rounded border" title="Aciertos globales: tomamos tu último intento por pregunta.">
              <div className="text-xs text-gray-500">Aciertos (global)</div>
              {loading ? <SkeletonLine className="mt-2" /> : <div className="text-xl font-medium">{totals.correct}</div>}
            </div>
            <div className="p-2 rounded border" title="Preguntas intentadas globalmente.">
              <div className="text-xs text-gray-500">Preguntas (global)</div>
              {loading ? <SkeletonLine className="mt-2" /> : <div className="text-xl font-medium">{totals.total}</div>}
            </div>
            <div className="p-2 rounded border" title="Precisión global = aciertos / preguntas × 100.">
              <div className="text-xs text-gray-500">Precisión (global)</div>
              {loading ? <SkeletonLine className="mt-2" /> : <div className="text-xl font-medium">{totals.pct}%</div>}
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Cálculo por <strong>último intento por pregunta</strong> en tu <strong>última sesión</strong>.
          </p>
        </div>

        <div className="p-3 border rounded-lg">
          <div className="font-medium">Bloque seleccionado</div>
          {!selectedBlock ? (
            <div className="text-sm text-gray-500 mt-2">Elige un bloque en la izquierda.</div>
          ) : (
            <>
              <div className="text-sm text-gray-600 mt-1 truncate" title={selectedBlockMeta?.block_title || ''}>
                {selectedBlockMeta?.block_code ? `${selectedBlockMeta.block_code} · ` : ''}{selectedBlockMeta?.block_title || '—'}
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <div className="p-2 rounded border" title="Aciertos en este bloque (último intento por pregunta).">
                  <div className="text-[11px] text-gray-500">Aciertos (bloque)</div>
                  <div className="text-lg font-medium">{sbCorrect}</div>
                </div>
                <div className="p-2 rounded border" title="Preguntas intentadas en este bloque.">
                  <div className="text-[11px] text-gray-500">Preguntas (bloque)</div>
                  <div className="text-lg font-medium">{sbTotal}</div>
                </div>
                <div className="p-2 rounded border" title="Precisión del bloque.">
                  <div className="text-[11px] text-gray-500">% Bloque</div>
                  <div className="text-lg font-medium">{sbPct}%</div>
                </div>
              </div>
              <div className="mt-2"><Bar value={sbPct} /></div>
            </>
          )}
        </div>
      </div>

      {err ? (
        <div className="p-3 border border-red-300 bg-red-50 rounded text-sm text-red-700 mb-4">{err}</div>
      ) : null}

      {/* Layout 2 columnas */}
      <div className="grid grid-cols-12 gap-4">
        {/* Sidebar: bloques */}
        <aside className="col-span-12 md:col-span-4">
          <div className="border rounded-lg">
            <div className="px-3 py-2 border-b bg-gray-50 rounded-t-lg flex justify-between items-center">
              <div className="font-medium">Bloques (últ. sesión)</div>
              <div className="text-xs text-gray-500">{blocks.length}</div>
            </div>
            <div className="max-h-[70vh] overflow-auto divide-y">
              {loading ? (
                <div className="p-3 space-y-2">
                  <SkeletonLine />
                  <SkeletonLine />
                  <SkeletonLine />
                </div>
              ) : blocks.length === 0 ? (
                <div className="p-3 text-sm text-gray-500">Aún no hay información de desempeño.</div>
              ) : (
                blocks.map((b) => {
                  const isActive = b.block_id === selectedBlock;
                  const c = Number(b.correct_option || 0);
                  const t = Number(b.total_option || 0);
                  const p = pct(c, t);
                  return (
                    <button
                      key={b.block_id}
                      onClick={() => setSelectedBlock(b.block_id)}
                      className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${isActive ? 'bg-indigo-50' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{b.block_title}</div>
                          <div className="text-xs text-gray-500">
                            {b.block_code || '—'} · {c}/{t} aciertos
                          </div>
                        </div>
                        <AccuracyPill correct={c} total={t} />
                      </div>
                      <div className="mt-2">
                        <Bar value={p} />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </aside>

        {/* Panel principal */}
        <main className="col-span-12 md:col-span-8">
          {/* Tabs */}
          <div className="border-b mb-3 flex gap-1">
            {[
              { key: 'resumen', label: 'Detalle del bloque' },
              { key: 'material', label: 'Material relacionado' },
              { key: 'recom', label: 'Recomendaciones' },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-3 py-2 -mb-px border-b-2 ${
                  activeTab === t.key ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab: Resumen */}
          {activeTab === 'resumen' && (
            <section className="space-y-3">
              {!selectedBlock ? (
                <div className="p-3 border rounded text-sm text-gray-600">Selecciona un bloque para ver su detalle.</div>
              ) : blockDetail.loading ? (
                <div className="p-3 border rounded">
                  <SkeletonLine className="mb-2" />
                  <SkeletonLine className="mb-2" />
                  <SkeletonLine />
                </div>
              ) : blockDetail.error ? (
                <div className="p-3 border rounded text-sm text-red-700 bg-red-50">{blockDetail.error}</div>
              ) : blockDetail.items.length === 0 ? (
                <div className="p-3 border rounded text-sm text-gray-600">No hay preguntas registradas en este bloque.</div>
              ) : (
                <div className="space-y-2">
                  {blockDetail.items.slice(0, 10).map((q) => {
                    const total = Number(q.total || 0);
                    const correct = Number(q.correct || 0);
                    const p = pct(correct, total);
                    return (
                      <div key={q.topic_id} className="p-3 border rounded">
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-medium truncate">{q.topic_name}</div>
                          <AccuracyPill correct={correct} total={total} />
                        </div>
                        <div className="mt-2">
                          <Bar value={p} />
                          <div className="text-xs text-gray-500 mt-1">{correct}/{total} aciertos (últ. intento)</div>
                        </div>
                      </div>
                    );
                  })}
                  {blockDetail.items.length > 10 && (
                    <div className="text-xs text-gray-500 mt-2">Mostrando 10 de {blockDetail.items.length}.</div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Tab: Material */}
          {activeTab === 'material' && (
            <section className="space-y-3">
              {!selectedBlock ? (
                <div className="p-3 border rounded text-sm text-gray-600">Selecciona un bloque para ver materiales.</div>
              ) : materials.loading ? (
                <div className="p-3 border rounded">
                  <SkeletonLine className="mb-2" />
                  <SkeletonLine className="mb-2" />
                  <SkeletonLine />
                </div>
              ) : materials.error ? (
                <div className="p-3 border rounded text-sm text-red-700 bg-red-50">{materials.error}</div>
              ) : !materials.data ? null : (
                <>
                  {/* Guía rápida */}
                  <div className="p-3 border rounded">
                    <div className="text-sm text-gray-500 mb-2">
                      Diagnóstico del bloque (últ. intento por pregunta):{' '}
                      <strong>{materials.data.diagnosis.accuracy}%</strong> ({materials.data.diagnosis.correctas}/{materials.data.diagnosis.total})
                    </div>
                    <ul className="list-disc ml-5 text-sm space-y-1">
                      {materials.data.guide.map((g, idx) => <li key={idx}>{g}</li>)}
                    </ul>
                  </div>

                  {/* Apuntes relacionados */}
                  <div className="border rounded">
                    <div className="px-3 py-2 border-b bg-gray-50 rounded-t">Apuntes relacionados</div>
                    <div className="divide-y">
                      {(showMoreApuntes ? materials.data.materials.apuntes : materials.data.materials.apuntes.slice(0, 5)).map((a) => {
                        const filesCount = apunteFilesCount(a.id);
                        return (
                          <div key={a.id} className="p-3 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-medium truncate">{a.titulo}</div>
                              {a.descripcion ? (
                                <div className="text-sm text-gray-600 line-clamp-2">{a.descripcion}</div>
                              ) : null}
                              <div className="text-xs text-gray-500 mt-1">
                                {a.autor || 'Anónimo'} · {new Date(a.creado_en).toLocaleDateString()}
                                {filesCount > 0 && <span className="ml-2">• {filesCount} archivo(s)</span>}
                              </div>
                            </div>
                            <div className="shrink-0 flex gap-2">
                              <button
                                onClick={() => openResource(a)}
                                className="px-2 py-1 rounded border text-sm hover:bg-gray-50"
                                title="Abrir el recurso externo o archivo del apunte"
                              >
                                Abrir recurso
                              </button>
                              <button
                                onClick={() => navigate(`/apunte/${a.id}`)}
                                className="px-2 py-1 rounded border text-sm hover:bg-gray-50"
                                title="Ver la ficha del apunte dentro de la app"
                              >
                                Ver apunte
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {materials.data.materials.apuntes.length === 0 && (
                        <div className="p-3 text-sm text-gray-600">No se encontraron apuntes para este bloque.</div>
                      )}
                      {materials.data.materials.apuntes.length > 5 && (
                        <div className="p-3">
                          <button
                            onClick={() => setShowMoreApuntes(s => !s)}
                            className="text-sm text-indigo-600 hover:underline"
                          >
                            {showMoreApuntes ? 'Ver menos' : `Ver más (${materials.data.materials.apuntes.length - 5})`}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Enlaces externos */}
                  {materials.data.materials.links?.length ? (
                    <div className="border rounded">
                      <div className="px-3 py-2 border-b bg-gray-50 rounded-t">Recursos externos</div>
                      <ul className="divide-y">
                        {materials.data.materials.links.slice(0, 6).map((l, i) => (
                          <li key={`${l.url}-${i}`} className="p-3">
                            <a
                              href={l.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-700 hover:underline"
                              title={l.url}
                            >
                              {l.title || l.url}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              )}
            </section>
          )}

          {/* Tab: Recomendaciones */}
          {activeTab === 'recom' && (
            <section className="space-y-3">
              {recs.loading ? (
                <div className="p-3 border rounded">
                  <SkeletonLine className="mb-2" />
                  <SkeletonLine className="mb-2" />
                  <SkeletonLine />
                </div>
              ) : recs.error ? (
                <div className="p-3 border rounded text-sm text-red-700 bg-red-50">{recs.error}</div>
              ) : recs.items.length === 0 ? (
                <div className="p-3 border rounded text-sm text-gray-600">No hay recomendaciones por ahora.</div>
              ) : (
                <div className="space-y-2">
                  {recs.items.slice(0, 8).map((t) => (
                    <div key={t.topic_id} className="p-3 border rounded">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{t.topic_name}</div>
                          <div className="text-xs text-gray-500">{t.accuracy}% precisión estimada</div>
                        </div>
                        <div className="shrink-0 flex gap-2">
                          <button
                            onClick={() => startPracticeForBlocks([t.topic_id], 8)}
                            className="px-2 py-1 rounded border text-sm hover:bg-gray-50"
                            title="Generar práctica para este bloque"
                          >
                            Practicar
                          </button>
                          <button
                            onClick={() => { setSelectedBlock(t.topic_id); setActiveTab('material'); }}
                            className="px-2 py-1 rounded border text-sm hover:bg-gray-50"
                            title="Ver material relacionado del bloque"
                          >
                            Ver material
                          </button>
                        </div>
                      </div>
                      <div className="mt-2"><Bar value={t.accuracy || 0} /></div>
                      {Array.isArray(t.suggested_readings) && t.suggested_readings.length > 0 && (
                        <div className="mt-2 text-sm">
                          <div className="text-gray-500 mb-1">Lecturas sugeridas:</div>
                          <ul className="list-disc ml-5 space-y-1">
                            {t.suggested_readings.slice(0, 3).map((r, i) => (
                              <li key={i}>
                                <a className="text-indigo-700 hover:underline" href={r.url} target="_blank" rel="noopener noreferrer">
                                  {r.title || r.url}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
