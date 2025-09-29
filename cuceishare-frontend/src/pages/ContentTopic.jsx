// src/pages/ContentTopic.jsx
import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

const API =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
  (typeof process !== 'undefined' && process.env?.REACT_APP_API_URL) ||
  'http://localhost:3001';

export default function ContentTopic() {
  const { subjectSlug, blockId } = useParams();
  const navigate = useNavigate();
  const token = useMemo(() => (typeof window !== 'undefined' ? localStorage.getItem('token') || '' : ''), []);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [block, setBlock] = useState(null);
  const [diag, setDiag] = useState({ total: 0, correctas: 0, accuracy: 0 });
  const [apuntes, setApuntes] = useState([]);
  const [archivos, setArchivos] = useState([]);
  const [links, setLinks] = useState([]);
  const [guide, setGuide] = useState([]);

  useEffect(() => {
    let alive = true;
    if (!token) { navigate('/login', { replace: true }); return; }

    (async () => {
      setLoading(true); setErr('');
      try {
        const { data } = await axios.get(`${API}/api/${subjectSlug}/materials/block/${blockId}`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { _t: Date.now() },
        });
        if (!alive) return;
        setBlock(data?.block || null);
        setDiag(data?.diagnosis || { total: 0, correctas: 0, accuracy: 0 });
        setApuntes(data?.materials?.apuntes || []);
        setArchivos(data?.materials?.archivos || []);
        setLinks(data?.materials?.links || []);
        setGuide(data?.guide || []);
      } catch (e) {
        if (!alive) return;
        setErr(e?.response?.data?.error || 'No se pudo cargar la guía');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [API, subjectSlug, blockId, token, navigate]); // eslint-disable-line

  const archivosPorApunte = useMemo(() => {
    const map = {};
    for (const f of archivos) (map[f.apunte_id] = map[f.apunte_id] || []).push(f);
    return map;
  }, [archivos]);

  return (
    <div className="max-w-5xl mx-auto">
      <header className="mb-4">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
          📚 Guía — {block?.titulo || 'Bloque'}
        </h1>
        <p className="text-sm text-slate-600">
          Contenido filtrado por tags del bloque. Solo se muestran materiales relacionados con este tema.
        </p>
      </header>

      {loading && <div className="p-4 rounded border bg-white">Cargando…</div>}
      {!loading && err && <div className="p-4 rounded-xl border bg-rose-50 text-rose-700">⚠️ {err}</div>}

      {!loading && !err && (
        <>
          {/* Diagnóstico rápido */}
          <section className="rounded-2xl border bg-white p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-500">Precisión en este bloque</div>
                <div className="text-2xl font-bold">{diag.accuracy}%</div>
              </div>
              <div className="flex-1 mx-6">
                <div className="h-2 bg-slate-200 rounded">
                  <div className="h-2 bg-indigo-600 rounded" style={{ width: `${Math.max(0, Math.min(100, diag.accuracy || 0))}%` }} />
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Correctas: {diag.correctas} / {diag.total}
                </div>
              </div>
              <div className="flex gap-2">
                <Link
                  to={`/ruta/${subjectSlug}`}
                  className="px-3 py-1.5 rounded-lg border bg-white hover:bg-slate-50 text-sm font-semibold"
                >
                  ← Volver a la ruta
                </Link>
              </div>
            </div>
          </section>

          {/* Plan sugerido */}
          {guide?.length > 0 && (
            <section className="rounded-2xl border bg-white p-4 mb-4">
              <h2 className="font-semibold mb-2">Plan sugerido</h2>
              <ol className="list-decimal ml-5 text-sm space-y-1">
                {guide.map((g, i) => (<li key={i}>{g}</li>))}
              </ol>
            </section>
          )}

          {/* Apuntes relacionados */}
          <section className="rounded-2xl border bg-white p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold">Apuntes relacionados</h2>
              <Link to="/buscar" className="text-sm underline">Ver todos en Buscar</Link>
            </div>
            {apuntes.length === 0 ? (
              <div className="text-sm text-slate-600">No se encontraron apuntes relacionados por tags.</div>
            ) : (
              <ul className="space-y-3">
                {apuntes.map((a) => (
                  <li key={a.id} className="border rounded-xl p-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">
                        {a.titulo}
                      </h3>
                      <div className="text-xs text-slate-500">{new Date(a.creado_en).toLocaleDateString()}</div>
                    </div>
                    {a.descripcion && <p className="text-sm text-slate-700 mt-1">{a.descripcion}</p>}
                    {/* Tags si el backend los incluye */}
                    {Array.isArray(a.tags) && a.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {a.tags.slice(0,10).map((t, i) => (
                          <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">#{String(t).toUpperCase()}</span>
                        ))}
                      </div>
                    )}
                    {/* Enlaces / archivos */}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {a.resource_url && (
                        <a
                          href={a.resource_url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-lg border bg-white hover:bg-slate-50 text-sm font-semibold"
                        >
                          Abrir recurso
                        </a>
                      )}
                      <Link
                        to={`/apunte/${a.id}`}
                        className="px-3 py-1.5 rounded-lg border bg-white hover:bg-slate-50 text-sm font-semibold"
                      >
                        Ver apunte
                      </Link>
                      {(archivosPorApunte[a.id] || []).map((f) => (
                        <a
                          key={f.id}
                          href={`${API}/uploads/${encodeURIComponent(f.filename)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-lg border bg-white hover:bg-slate-50 text-sm text-slate-700"
                        >
                          {f.originalname || 'Descargar archivo'}
                        </a>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Enlaces externos curados */}
          {links.length > 0 && (
            <section className="rounded-2xl border bg-white p-4 mb-4">
              <h2 className="font-semibold mb-2">Enlaces recomendados</h2>
              <ul className="list-disc ml-5 text-sm space-y-1">
                {links.map((l, i) => (
                  <li key={i}>
                    <a className="underline" href={l.url} target="_blank" rel="noreferrer">
                      {l.title || l.url}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
