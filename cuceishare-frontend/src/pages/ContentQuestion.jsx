// src/pages/ContentQuestion.jsx
import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

const API =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
  (typeof process !== 'undefined' && process.env?.REACT_APP_API_URL) ||
  'http://localhost:3001';

export default function ContentQuestion() {
  const { subjectSlug, questionId } = useParams();
  const navigate = useNavigate();
  const token = useMemo(() => (typeof window !== 'undefined' ? localStorage.getItem('token') || '' : ''), []);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [q, setQ] = useState(null);
  const [choices, setChoices] = useState([]);
  const [keys, setKeys] = useState([]);

  useEffect(() => {
    let alive = true;
    if (!token) { navigate('/login', { replace: true }); return; }
    (async () => {
      setLoading(true); setErr('');
      try {
        const { data } = await axios.get(`${API}/api/${subjectSlug}/question/${questionId}`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { _t: Date.now() },
        });
        if (!alive) return;
        setQ(data?.question || null);
        setChoices(data?.choices || []);
        setKeys(data?.openKeys || []);
      } catch (e) {
        if (!alive) return;
        setErr(e?.response?.data?.error || 'No se pudo cargar la pregunta');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [API, subjectSlug, questionId, token, navigate]); // eslint-disable-line

  const correctChoice = choices.find(c => c.es_correcta || c.correct);

  return (
    <div className="max-w-3xl mx-auto">
      <header className="mb-4">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">💡 Explicación</h1>
        <p className="text-sm text-slate-600">Pregunta y opciones con la respuesta marcada.</p>
      </header>

      {loading && <div className="p-4 rounded border bg-white">Cargando…</div>}
      {!loading && err && <div className="p-4 rounded-xl border bg-rose-50 text-rose-700">⚠️ {err}</div>}

      {!loading && !err && q && (
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm text-slate-500 mb-1">Dificultad: {q.dificultad}</div>
          <p className="font-medium">{q.enunciado}</p>

          {q.tipo === 'opcion' && (
            <ul className="mt-3 space-y-2">
              {choices.map((c) => (
                <li
                  key={c.id}
                  className={`p-2 rounded border ${c.id === (correctChoice?.id) ? 'bg-emerald-50 border-emerald-300' : 'bg-white'}`}
                >
                  {c.texto}
                  {c.id === (correctChoice?.id) && <span className="ml-2 text-emerald-700 text-sm">✔ Correcta</span>}
                </li>
              ))}
            </ul>
          )}

          {q.tipo === 'abierta' && keys?.length > 0 && (
            <div className="mt-3 text-sm text-slate-700">
              Pistas clave: {keys.map(k => k.palabra).join(', ')}
            </div>
          )}

          <div className="mt-4">
            <Link to={`/ruta/${subjectSlug}`} className="px-3 py-1.5 rounded-lg border bg-white hover:bg-slate-50 text-sm font-semibold">
              ← Volver a la ruta
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
