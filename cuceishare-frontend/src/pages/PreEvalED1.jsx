// src/pages/PreEvalED1.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3001';

const SUBJECT_SLUG = 'ed1'; // 👈 materia de esta pantalla

const cx = (...xs) => xs.filter(Boolean).join(' ');
const Icon = ({ children, className='' }) => (
  <span className={cx('inline-grid place-items-center rounded-lg', className)}>{children}</span>
);
const Skeleton = ({ className='' }) => <div className={cx('animate-pulse bg-gray-200/70 rounded', className)} />;

export default function PreEvalED1() {
  const navigate = useNavigate();

  // Session
  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('usuario') || 'null'); } catch { return null; }
  }, []);
  const token = useMemo(() => localStorage.getItem('token') || '', []);
  const userId = user?.id ?? null;

  // Draft key por usuario + materia (evita mezclar borradores de otras materias)
  const draftKey = useMemo(
    () => `ed1:preeval:draft:${user?.id ?? 'anon'}`,
    [user?.id]
  );

  // Estado principal (estado "crudo" + estado filtrado)
  const [raw, setRaw] = useState({ subject: null, blocks: [], questions: [], choices: [], openKeys: [] });
  const [blocks, setBlocks] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [choices, setChoices] = useState([]);
  const [openKeys, setOpenKeys] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [info, setInfo] = useState('');

  const [selectedChoice, setSelectedChoice] = useState(() => {
    try { return JSON.parse(localStorage.getItem(draftKey) || '{}').choices || {}; } catch { return {}; }
  });
  const [openAnswers, setOpenAnswers] = useState(() => {
    try { return JSON.parse(localStorage.getItem(draftKey) || '{}').opens || {}; } catch { return {}; }
  });
  const [draftState, setDraftState] = useState('saved');
  const [collapsed, setCollapsed] = useState({});
  const topRef = useRef(null);

  // Redirect si no hay sesión
  useEffect(() => {
    if (!user || !token) navigate('/login', { replace: true });
  }, [userId, token, navigate]);

  // Carga banco de preguntas (pide por materia)
  useEffect(() => {
    let alive = true;
    if (!user || !token) return;
    (async () => {
      setLoading(true); setError('');
      try {
        const { data } = await axios.get(`${API}/api/ed1/pre-eval`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { subjectSlug: SUBJECT_SLUG, _t: Date.now() }, // 👈 pedimos por materia
        });

        if (!alive) return;

        // Guardamos crudo
        const subject = data?.subject ?? null;
        const rawBlocks = Array.isArray(data?.blocks) ? data.blocks : [];
        const rawQuestions = Array.isArray(data?.questions) ? data.questions : [];
        const rawChoices = Array.isArray(data?.choices) ? data.choices : [];
        const rawOpenKeys = Array.isArray(data?.openKeys) ? data.openKeys : [];

        setRaw({ subject, blocks: rawBlocks, questions: rawQuestions, choices: rawChoices, openKeys: rawOpenKeys });

        // Notifica borrador restaurado
        if (localStorage.getItem(draftKey)) setInfo('Se restauró tu borrador automáticamente.');
      } catch (e) {
        if (!alive) return;
        if (e?.response?.status === 401) { navigate('/login', { replace: true }); return; }
        setError(e?.response?.data?.error || 'No se pudo cargar la pre-evaluación');
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [userId, token, navigate, draftKey]);

  // Filtrado defensivo por materia (si el backend trae de más)
  useEffect(() => {
    // 1) Determinar subjectId si viene del backend
    const subjectId = raw?.subject?.id || null;

    // 2) Filtrar bloques por subjectId si existe; si no, asumimos que el backend ya filtró
    const filteredBlocks = subjectId
      ? raw.blocks.filter(b => String(b.subject_id || '') === String(subjectId))
      : raw.blocks.slice();

    const allowedBlockIds = new Set(filteredBlocks.map(b => b.id));

    // 3) Filtrar preguntas solo de esos bloques
    const filteredQuestions = raw.questions.filter(q => allowedBlockIds.has(q.block_id));
    const allowedQuestionIds = new Set(filteredQuestions.map(q => q.id));

    // 4) Filtrar choices y openKeys que pertenezcan a esas preguntas
    const filteredChoices = raw.choices.filter(c => allowedQuestionIds.has(c.question_id));
    const filteredOpenKeys = raw.openKeys.filter(k => allowedQuestionIds.has(k.question_id));

    setBlocks(filteredBlocks);
    setQuestions(filteredQuestions);
    setChoices(filteredChoices);
    setOpenKeys(filteredOpenKeys);
  }, [raw]);

  // Guardado de borrador (por materia)
  useEffect(() => {
    setDraftState('saving');
    const h = setTimeout(() => {
      localStorage.setItem(draftKey, JSON.stringify({ choices: selectedChoice, opens: openAnswers }));
      setDraftState('saved');
    }, 300);
    return () => clearTimeout(h);
  }, [selectedChoice, openAnswers, draftKey]);

  // Índices
  const choicesByQ = useMemo(() => {
    const m = {}; for (const c of choices) (m[c.question_id] ||= []).push(c); return m;
  }, [choices]);
  const openKeysByQ = useMemo(() => {
    const m = {}; for (const k of openKeys) (m[k.question_id] ||= []).push(k); return m;
  }, [openKeys]);
  const questionsByBlock = useMemo(() => {
    const m = {}; for (const q of questions) (m[q.block_id] ||= []).push(q);
    for (const k of Object.keys(m)) m[k].sort((a, b) => String(a.id).localeCompare(String(b.id)));
    return m;
  }, [questions]);

  // Progreso
  const totalPreguntas = questions.length;
  const respondidas = useMemo(() => {
    let c = 0; for (const q of questions) {
      if (q.tipo === 'opcion' && selectedChoice[q.id]) c++;
      if (q.tipo === 'abierta' && (openAnswers[q.id] || '').trim()) c++;
    } return c;
  }, [questions, selectedChoice, openAnswers]);
  const progresoPct = totalPreguntas ? Math.round((respondidas / totalPreguntas) * 100) : 0;

  const blockProgress = useMemo(() => {
    const res = {};
    for (const b of blocks) {
      const qs = questionsByBlock[b.id] || []; let done = 0;
      for (const q of qs) {
        if (q.tipo === 'opcion' && selectedChoice[q.id]) done++;
        if (q.tipo === 'abierta' && (openAnswers[q.id] || '').trim()) done++;
      }
      res[b.id] = { done, total: qs.length, pct: qs.length ? Math.round((done / qs.length) * 100) : 0 };
    } return res;
  }, [blocks, questionsByBlock, selectedChoice, openAnswers]);

  // Guardar (POST)
  const handleSubmit = async () => {
    setOk(''); setError('');
    if (!user || !token) { navigate('/login', { replace: true }); return; }
    const respuestas = [];
    for (const q of questions) {
      if (q.tipo === 'opcion') {
        const ch = selectedChoice[q.id];
        if (ch) respuestas.push({ blockId: q.block_id, questionId: q.id, type: 'opcion', choiceId: ch });
      } else {
        const txt = (openAnswers[q.id] || '').trim();
        if (txt) respuestas.push({ blockId: q.block_id, questionId: q.id, type: 'abierta', answerText: txt });
      }
    }
    if (!respuestas.length) { setError('No has respondido ninguna pregunta.'); return; }
    try {
      setSaving(true);
      await axios.post(`${API}/api/ed1/attempts`, { subjectSlug: SUBJECT_SLUG, respuestas }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOk('¡Respuestas guardadas!');
      setTimeout(() => setOk(''), 2000);
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      if (e?.response?.status === 401) { navigate('/login', { replace: true }); return; }
      setError(e?.response?.data?.error || 'No se pudo guardar la pre-evaluación');
      setTimeout(() => setError(''), 3000);
    } finally { setSaving(false); }
  };

  // Atajo Ctrl/Cmd+S
  const onKey = useCallback((e) => {
    const mac = navigator.platform.toUpperCase().includes('MAC');
    if ((mac && e.metaKey && e.key.toLowerCase() === 's') || (!mac && e.ctrlKey && e.key.toLowerCase() === 's')) {
      e.preventDefault(); handleSubmit();
    }
  }, []); 
  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKey]);

  // Helpers UI
  const shortId = (id) => String(id).slice(-4).padStart(4, '0');

  if (!user || !token) return <div className="p-6 text-center">Redirigiendo…</div>;

  return (
    <div ref={topRef} className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {/* App Bar */}
      <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          {/* Breadcrumb + título */}
          <div className="flex items-center gap-3 min-w-0">
            <Icon className="h-9 w-9 bg-indigo-600/10 text-indigo-700">📝</Icon>
            <div className="truncate">
              <nav className="text-xs text-slate-500 truncate" aria-label="Breadcrumb">
                <ol className="flex items-center gap-1">
                  <li className="hover:text-slate-700 cursor-default">Aprendizaje</li>
                  <li className="text-slate-400">/</li>
                  <li className="hover:text-slate-700 cursor-default">ED I</li>
                  <li className="text-slate-400">/</li>
                  <li className="text-slate-700 font-medium truncate">Pre-evaluación</li>
                </ol>
              </nav>
              <h1 className="text-lg md:text-xl font-bold tracking-tight text-slate-900">
                Pre-evaluación — <span className="text-indigo-700">Estructuras de Datos I</span>
              </h1>
              <p className="text-[11px] text-slate-500">Usuario: <span className="font-mono">#{user.id}</span></p>
            </div>
          </div>

          {/* Progreso + acciones */}
          <div className="hidden md:flex items-center gap-3">
            <div className="w-48">
              <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                <span>{respondidas}/{totalPreguntas}</span>
                <span>{progresoPct}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-2 rounded-full bg-indigo-600 transition-[width] duration-500"
                  style={{ width: `${progresoPct}%` }}
                  aria-label={`Progreso ${progresoPct}%`}
                />
              </div>
            </div>
            <button
              onClick={() => navigate('/ruta/ed1')}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm shadow-sm"
            >
              📈 Ver mi ruta
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm shadow-sm"
              title="Ctrl/Cmd + S"
            >
              💾 {saving ? 'Guardando…' : 'Guardar'}
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
        {info && (
          <div className="max-w-md w-full rounded-xl border bg-sky-50 text-sky-800 px-3 py-2 shadow">
            💡 {info}
          </div>
        )}
      </div>

      {/* Contenido */}
      <main className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Columna principal */}
        <div>
          {/* Barra de herramientas */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                const next = {}; blocks.forEach(b => next[b.id] = false); setCollapsed(next);
              }}
              className="px-3 py-1.5 rounded-full border bg-white hover:bg-slate-50 text-slate-700"
            >
              Expandir todo
            </button>
            <button
              onClick={() => {
                const next = {}; blocks.forEach(b => next[b.id] = true); setCollapsed(next);
              }}
              className="px-3 py-1.5 rounded-full border bg-white hover:bg-slate-50 text-slate-700"
            >
              Contraer todo
            </button>
            <div className="ml-auto flex items-center gap-3 text-xs">
              <kbd className="px-2 py-1 rounded bg-slate-100 text-slate-700 border">Ctrl/Cmd + S</kbd>
              <span className={cx(
                'px-2 py-1 rounded',
                draftState === 'saving' ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'
              )}>
                {draftState === 'saving' ? 'Guardando borrador…' : 'Borrador guardado ✓'}
              </span>
            </div>
          </div>

          {/* Estados */}
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-64" />
              <div className="grid md:grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="p-5 bg-white rounded-2xl shadow border">
                    <Skeleton className="h-5 w-40 mb-3" />
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-4/5 mb-2" />
                    <Skeleton className="h-4 w-3/5" />
                  </div>
                ))}
              </div>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-50 border text-rose-700">{error}</div>
          ) : !blocks.length ? (
            <div className="p-6 rounded-2xl border bg-white shadow-sm text-center">
              <div className="text-4xl mb-2">🧩</div>
              <h2 className="font-bold text-lg">Sin bloques configurados</h2>
              <p className="text-slate-600 text-sm">Aún no hay preguntas disponibles para esta pre-evaluación.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {blocks.map((b, bIndex) => {
                const bp = (()=>{
                  const qs = questionsByBlock[b.id] || [];
                  const done = qs.reduce((acc, q)=>
                    acc + (q.tipo === 'opcion' ? !!selectedChoice[q.id] : !!(openAnswers[q.id]||'').trim()), 0
                  );
                  return { done, total: qs.length, pct: qs.length ? Math.round((done/qs.length)*100) : 0 };
                })();

                const isCol = !!collapsed[b.id];
                const qs = questionsByBlock[b.id] || [];

                return (
                  <section
                    key={b.id}
                    className="bg-white rounded-2xl shadow-sm border overflow-hidden transition-all"
                    aria-label={`Bloque ${b.titulo}`}
                  >
                    {/* Header de bloque */}
                    <div className="px-5 py-4 flex items-center gap-3">
                      <button
                        onClick={() => setCollapsed(p => ({ ...p, [b.id]: !p[b.id] }))}
                        className="shrink-0 h-8 w-8 grid place-items-center rounded-lg bg-slate-100 hover:bg-slate-200"
                        aria-expanded={!isCol}
                        aria-controls={`block-${b.id}`}
                        title={isCol ? 'Expandir bloque' : 'Contraer bloque'}
                      >
                        {isCol ? '⤢' : '⤡'}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center justify-center h-6 px-2 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold">
                            Bloque {bIndex + 1}
                          </span>
                          <h2 className="text-lg md:text-xl font-bold truncate">{b.titulo}</h2>
                        </div>
                        <div className="mt-2">
                          <div className="h-2 bg-slate-200 rounded">
                            <div className="h-2 rounded bg-indigo-600 transition-[width] duration-500" style={{ width: `${bp.pct}%` }} />
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1">{bp.done}/{bp.total} ({bp.pct}%)</div>
                        </div>
                      </div>
                    </div>

                    {/* Contenido de bloque */}
                    {!isCol && (
                      <div id={`block-${b.id}`} className="px-5 pb-5 space-y-5">
                        {qs.map((q, idx) => (
                          <article key={q.id} className="border rounded-xl p-4 hover:shadow-sm transition-shadow focus-within:ring-1 focus-within:ring-indigo-200">
                            <div className="mb-3 flex items-start gap-3">
                              <Icon className="h-7 w-7 bg-indigo-50 text-indigo-700 text-xs">{idx + 1}</Icon>
                              <h3 className="font-medium leading-6">{q.enunciado}</h3>
                              <span className="ml-auto text-[11px] text-slate-400">ID …{shortId(q.id)}</span>
                            </div>

                            {q.tipo === 'opcion' ? (
                              <fieldset className="ml-10 space-y-2" aria-label={`Opciones de la pregunta ${idx + 1}`}>
                                {(choicesByQ[q.id] || []).map(c => {
                                  const checked = String(selectedChoice[q.id] || '') === String(c.id);
                                  return (
                                    <label
                                      key={c.id}
                                      className={cx(
                                        'flex items-start gap-2 cursor-pointer rounded-lg border p-2 hover:bg-slate-50 focus-within:ring-2 focus-within:ring-indigo-300',
                                        checked ? 'border-indigo-300 bg-indigo-50/40' : 'border-slate-200'
                                      )}
                                    >
                                      <input
                                        type="radio"
                                        className="mt-1 accent-indigo-600"
                                        name={`q_${q.id}`}
                                        value={c.id}
                                        checked={checked}
                                        onChange={() => { setSelectedChoice(p => ({ ...p, [q.id]: c.id })); setOk(''); setError(''); }}
                                        aria-checked={checked}
                                        aria-label={c.texto}
                                      />
                                      <span>{c.texto}</span>
                                    </label>
                                  );
                                })}
                              </fieldset>
                            ) : (
                              <div className="ml-10">
                                <textarea
                                  className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-indigo-300"
                                  rows={3}
                                  placeholder="Escribe tu respuesta…"
                                  value={openAnswers[q.id] || ''}
                                  onChange={(e) => { setOpenAnswers(p => ({ ...p, [q.id]: e.target.value })); setOk(''); setError(''); }}
                                  aria-label={`Respuesta abierta de la pregunta ${idx + 1}`}
                                />
                                {openKeysByQ[q.id]?.length ? (
                                  <p className="text-xs text-slate-500 mt-1">
                                    Pistas: {openKeysByQ[q.id].map(k => k.palabra).join(', ')}
                                  </p>
                                ) : null}
                              </div>
                            )}
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="lg:sticky lg:top-[64px] h-max space-y-4">
          <div className="rounded-2xl border bg-white shadow-sm p-4">
            <h3 className="font-bold mb-1">Progreso</h3>
            <p className="text-xs text-slate-500 mb-2">Responde todo lo que puedas — puedes volver luego.</p>
            <div className="mb-2">
              <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                <span>{respondidas}/{totalPreguntas}</span>
                <span>{progresoPct}%</span>
              </div>
              <div className="h-2 bg-slate-200 rounded">
                <div className="h-2 bg-indigo-600 rounded transition-[width] duration-500" style={{ width: `${progresoPct}%` }} />
              </div>
            </div>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="w-full px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold shadow-sm"
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            {ok && <p className="text-emerald-700 text-xs mt-2">✅ {ok}</p>}
            {error && !loading && <p className="text-rose-700 text-xs mt-2">⚠️ {error}</p>}
            <div className="text-[11px] text-slate-500 mt-2">
              Borrador: {draftState === 'saving' ? 'guardando…' : 'guardado ✓'}
            </div>
          </div>

          {/* Tips rápidos */}
          <div className="rounded-2xl border bg-white shadow-sm p-4">
            <h3 className="font-bold mb-2">Atajos</h3>
            <ul className="text-sm text-slate-600 space-y-1">
              <li><kbd className="px-1.5 py-0.5 border rounded bg-slate-50">Ctrl/Cmd + S</kbd> Guardar</li>
              <li><span className="px-1.5 py-0.5 border rounded bg-slate-50">⤡</span> Contraer / expandir bloque</li>
            </ul>
          </div>
        </aside>
      </main>

      {/* Botón flotante (móvil) */}
      <div className="fixed bottom-4 right-4 z-40 md:hidden">
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="h-12 px-5 rounded-full shadow-lg text-white font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60"
          aria-label="Guardar respuestas"
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>

      {/* Footer */}
      <footer className="border-t bg-white/70">
        <div className="max-w-7xl mx-auto px-4 py-3 text-[11px] text-slate-500 flex items-center justify-between">
          <span>Pre-evaluación ED I</span>
          <span>Ctrl/Cmd + S para guardar rápido</span>
        </div>
      </footer>
    </div>
  );
}
