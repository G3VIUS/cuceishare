// src/pages/ResourceList.jsx
import { useEffect, useMemo, useState } from "react";

const API =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  process.env.REACT_APP_API_URL ||
  "http://localhost:3001";

/**
 * Props:
 *  - materiaSlug?  (ed1 | aserv | mineria | redes | algoritmia)
 *  - subjectSlug?  (slug crudo tal como está en la fila)
 *  - limit?        (default 50)
 */
export default function ResourceList(props) {
  // Usamos nombres locales para evitar “no definido”
  const materia = props?.materiaSlug;
  const subject = props?.subjectSlug;
  const lim = Math.min(Math.max(parseInt(props?.limit ?? 50, 10) || 50, 1), 200);

  const [items, setItems] = useState([]);
  const [loading, setLoad] = useState(false);
  const [error, setError] = useState("");

  const url = useMemo(() => {
    if (materia) {
      return `${API}/recursos?materia=${encodeURIComponent(materia)}&limit=${lim}`;
    }
    if (subject) {
      return `${API}/recursos?subject_slug=${encodeURIComponent(subject)}&limit=${lim}`;
    }
    return "";
  }, [materia, subject, lim]);

  useEffect(() => {
    let alive = true;
    if (!url) {
      setItems([]);
      return;
    }
    (async () => {
      setLoad(true);
      setError("");
      try {
        const r = await fetch(url);
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
        if (!Array.isArray(j)) throw new Error("Respuesta inesperada");
        if (alive) setItems(j);
      } catch (e) {
        if (alive) {
          setError(e.message || "No se pudieron cargar los recursos");
          setItems([]);
        }
      } finally {
        if (alive) setLoad(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [url]);

  // No mostrar nada si no se pasó ningún filtro
  if (!materia && !subject) return null;

  return (
    <div className="space-y-2">
      {loading && <div className="text-sm text-slate-500">Cargando recursos…</div>}
      {error && (
        <div className="text-sm text-rose-700 bg-rose-50 border rounded p-2">⚠️ {error}</div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="text-sm text-slate-500">No hay recursos aún.</div>
      )}

      {!loading && !error && items.length > 0 && (
        <ul className="grid gap-2">
          {items.map((r) => (
            <li key={r.id} className="rounded-lg border p-3 bg-white hover:border-indigo-200">
              <a
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-700 hover:underline font-medium"
              >
                {r.titulo || r.url}
              </a>
              {r.descripcion && (
                <p className="text-xs text-slate-600 mt-1 line-clamp-2">{r.descripcion}</p>
              )}
              <div className="text-[11px] text-slate-400 mt-1">
                {r.materia_norm
                  ? `Materia: ${r.materia_norm}`
                  : r.subject_slug
                  ? `Slug: ${r.subject_slug}`
                  : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
