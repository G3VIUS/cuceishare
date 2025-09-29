import { useEffect, useMemo, useState, useCallback } from 'react';
import { useLocation, useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

const API =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
  (typeof process !== 'undefined' && process.env?.REACT_APP_API_URL) ||
  'http://localhost:3001';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function Practice() {
  const { subjectSlug } = useParams();
  const q = useQuery();
  const sid = q.get('sid') || '';
  const idsCsv = q.get('q') || '';
  const token = useMemo(() => (typeof window !== 'undefined' ? localStorage.getItem('token') || '' : ''), []);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [questions, setQuestions] = useState([]);
  const [choices, setChoices] = useState([]);
  const [openKeys, setOpenKeys] = useState([]);
  const [answers, setAnswers] = useState({});     // {qid:{type,choiceId?,answerText?}}
  const [sent, setSent] = useState(false);

  // Modo estudio
  const [studyMode, setStudyMode] = useState(true);
  const [current, setCurrent] = useState(0);
  const [materials, setMaterials] = useState({}); // {blockId:{loading,data}}

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const qChoices = useMemo(() => {
    const map = {};
    for (const c of choices) (map[c.question_id] = map[c.question_id] || []).push(c);
    return map;
  }, [choices]);

  const qKeys = useMemo(() => {
    const map = {};
    for (const k of openKeys) (map[k.question_id] = map[k.question_id] || []).push(k.palabra);
    return map;
  }, [openKeys]);

  useEffect(() => {
    let alive = true;
    if (!token) { navigate('/login', { replace: true }); return; }
    if (!sid || !idsCsv) { setErr('Sesión o preguntas no especificadas'); setLoading(false); return; }

    (async () => {
      setLoading(true); setErr('');
      try {
        const { data } = await axios.get(`${API}/api/${subjectSlug}/questions`, {
          headers,
          params: { ids: idsCsv, _t: Date.now() },
        });
        if (!alive) return;
        setQuestions(data?.questions || []);
        setChoices(data?.choices || []);
        setOpenKeys(data?.openKeys || []);
      } catch (e) {
        if (!alive) return;
        setErr(e?.response?.data?.error || 'No se pudieron cargar las preguntas');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [API, subjectSlug, token, sid, idsCsv]); // eslint-disable-line

  const loadMaterials = useCallback(async (blockId) => {
    if (!blockId || materials[blockId]?.data || materials[blockId]?.loading) return;
    setMaterials(prev => ({ ...prev, [blockId]: { loading: true, data: null } }));
    try {
      const { data } = await axios.get(`${API}/api/${subjectSlug}/materials/block/${blockId}`, { headers });
      setMaterials(prev => ({ ...prev, [blockId]: { loading: false, data } }));
    } catch {
      setMaterials(prev => ({ ...prev, [blockId]: { loading: false, data: { materials:{apuntes:[],archivos:[],links:[]}, diagnosis:{accuracy:0}, block:{} } } }));
    }
  }, [API, subjectSlug, headers, materials]);

  // cargar materiales del bloque de la pregunta actual (en modo estudio)
  useEffect(() => {
    if (!studyMode) return;
    const q = questions[current];
    if (q?.block_id) loadMaterials(q.block_id);
  }, [studyMode, current, questions, loadMaterials]);

  const handleSelect = (qid, choiceId) => {
    setAnswers(prev => ({ ...prev, [qid]: { type: 'opcion', questionId: qid, choiceId } }));
  };

  const handleText = (qid, text) => {
    setAnswers(prev => ({ ...prev, [qid]: { type: 'abierta', questionId: qid, answerText: text } }));
  };

  const isCorrect = (qid) => {
    const ch = qChoices[qid] || [];
    const a = answers[qid];
    if (!a?.choiceId) return null;
    const cc = ch.find(x => x.es_correcta || x.correct);
    return cc ? cc.id === a.choiceId : null;
  };

  const submit = async () => {
    try {
      const payload = {
        sessionId: sid,
        respuestas: questions.map(q => {
          const a = answers[q.id];
          if (!a) return { blockId: q.block_id, questionId: q.id, type: q.tipo === 'opcion' ? 'opcion' : 'abierta' };
          return { blockId: q.block_id, questionId: q.id, type: a.type, choiceId: a.choiceId, answerText: a.answerText };
        }),
      };
      await axios.post(`${API}/api/${subjectSlug}/attempts`, payload, {
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
      setSent(true);
    } catch (e) {
      setErr(e?.response?.data?.error || 'No se pudieron guardar tus respuestas');
    }
  };

  const goExplain = (qid) => navigate(`/content/${subjectSlug}/question/${qid}`);

  const qNow = questions[current] || null;
  const chNow = qNow ? (qChoices[qNow.id] || []) : [];
  const mat = qNow ? materials[qNow.block_id] : null;

  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Práctica — {subjectSlug}</h1>
          <p className="text-sm text-slate-600">Sesión: <span className="font-mono">{sid}</span></p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={studyMode} onChange={(e) => setStudyMode(e.target.checked)} />
          Modo estudio (feedback + materiales)
        </label>
      </header>

      {loading && <div className="p-4 rounded border bg-white">Cargando…</div>}
      {!loading && err && <div className="p-4 rounded-xl border bg-rose-50 text-rose-700">⚠️ {err}</div>}
      {!loading && !err && questions.length === 0 && (
        <div className="p-4 rounded-xl border bg-white">No hay preguntas para esta práctica.</div>
      )}

      {!loading && !err && questions.length > 0 && (
        <div className={`grid ${studyMode ? 'md:grid-cols-3' : 'grid-cols-1'} gap-4`}>
          {/* Columna principal (pregunta actual) */}
          <div className={`${studyMode ? 'md:col-span-2' : ''} space-y-4`}>
            <div className="rounded-xl border bg-white p-4">
              <div className="flex items-start justify-between">
                <h3 className="font-semibold">Pregunta {current + 1} de {questions.length}</h3>
                <span className="text-xs text-slate-500">Dificultad: {qNow?.dificultad}</span>
              </div>
              <p className="mt-2">{qNow?.enunciado}</p>

              {qNow?.tipo === 'opcion' ? (
                <div className="mt-3 space-y-2">
                  {chNow.map(opt => {
                    const selected = answers[qNow.id]?.choiceId === opt.id;
                    const correct = opt.es_correcta || opt.correct;
                    const showFeedback = studyMode && answers[qNow.id]?.choiceId;
                    const border =
                      showFeedback && correct ? 'border-emerald-300 bg-emerald-50' :
                      showFeedback && selected && !correct ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-white';
                    return (
                      <label key={opt.id} className={`flex items-center gap-2 p-2 rounded border ${border}`}>
                        <input
                          type="radio"
                          name={`q_${qNow.id}`}
                          onChange={() => handleSelect(qNow.id, opt.id)}
                          checked={selected}
                        />
                        <span>{opt.texto}</span>
                        {showFeedback && correct && <span className="ml-auto text-emerald-700 text-sm">✔ Correcta</span>}
                        {showFeedback && selected && !correct && <span className="ml-auto text-rose-700 text-sm">✖</span>}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-3">
                  <textarea
                    className="w-full border rounded-lg p-2"
                    rows={3}
                    placeholder="Escribe tu respuesta…"
                    onChange={(e) => handleText(qNow.id, e.target.value)}
                    value={answers[qNow.id]?.answerText || ''}
                  />
                  {studyMode && qKeys[qNow.id]?.length > 0 && (
                    <div className="mt-2 text-xs text-slate-600">
                      Pista: intenta mencionar <em>{qKeys[qNow.id].slice(0,3).join(', ')}</em>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => setCurrent((i) => Math.max(0, i - 1))}
                  disabled={current === 0}
                  className="px-3 py-1.5 rounded-lg border bg-white hover:bg-slate-50 text-sm font-semibold disabled:opacity-50"
                >
                  ← Anterior
                </button>
                <button
                  onClick={() => setCurrent((i) => Math.min(questions.length - 1, i + 1))}
                  disabled={current === questions.length - 1}
                  className="px-3 py-1.5 rounded-lg border bg-white hover:bg-slate-50 text-sm font-semibold disabled:opacity-50"
                >
                  Siguiente →
                </button>
                <button
                  onClick={() => goExplain(qNow.id)}
                  className="px-3 py-1.5 rounded-lg border bg-white hover:bg-slate-50 text-sm font-semibold"
                >
                  💡 Explicación
                </button>
              </div>
            </div>

            {!sent ? (
              <button
                onClick={submit}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
              >
                Enviar respuestas
              </button>
            ) : (
              <div className="p-4 rounded-xl border bg-emerald-50 text-emerald-700">
                ✅ Respuestas enviadas. Vuelve a la{' '}
                <Link to={`/ruta/${subjectSlug}`} className="underline font-semibold">Ruta</Link> para ver el impacto en tus recomendaciones.
              </div>
            )}
          </div>

          {/* Columna lateral (materiales del bloque) */}
          {studyMode && (
            <aside className="space-y-4">
              <div className="rounded-xl border bg-white p-4">
                <h4 className="font-semibold">📚 Material del bloque</h4>
                {!qNow && <div className="text-sm text-slate-600 mt-2">—</div>}
                {qNow && (
                  <>
                    {mat?.loading && <div className="text-sm mt-2">Cargando…</div>}
                    {mat?.data && (
                      <>
                        <div className="text-xs text-slate-500 mt-1">
                          Precisión bloque: {mat.data.diagnosis?.accuracy ?? 0}%
                        </div>

                        <div className="mt-3">
                          <div className="text-sm font-medium mb-1">Apuntes</div>
                          {mat.data.materials.apuntes.length === 0 ? (
                            <div className="text-xs text-slate-500">No hay apuntes.</div>
                          ) : (
                            <ul className="text-sm list-disc ml-5">
                              {mat.data.materials.apuntes.slice(0,3).map(a => (
                                <li key={a.id}>
                                  {a.resource_url ? (
                                    <a href={a.resource_url} target="_blank" rel="noreferrer" className="underline">{a.titulo}</a>
                                  ) : (
                                    <span>{a.titulo}</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <div className="mt-3">
                          <div className="text-sm font-medium mb-1">Enlaces</div>
                          {mat.data.materials.links.length === 0 ? (
                            <div className="text-xs text-slate-500">Sin enlaces.</div>
                          ) : (
                            <ul className="text-sm list-disc ml-5">
                              {mat.data.materials.links.slice(0,3).map((l,i) => (
                                <li key={i}><a href={l.url} target="_blank" rel="noreferrer" className="underline">{l.title || l.url}</a></li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <div className="mt-3">
                          <Link
                            to={`/content/${subjectSlug}/topic/${qNow.block_id}`}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-white hover:bg-slate-50 text-sm font-semibold"
                          >
                            Abrir guía del bloque →
                          </Link>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
