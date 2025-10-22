// src/pages/Buscar.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";

const API =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  process.env.REACT_APP_API_URL ||
  "http://localhost:3001";

/* ===== Helpers ===== */

// Paleta por materia
const materiaColor = (m) => {
  if (!m) return "bg-slate-100 text-slate-700";
  const key = String(m).toLowerCase();
  if (key.includes("estructuras")) return "bg-violet-100 text-violet-700";
  if (key.includes("servidores") || key.includes("aserv")) return "bg-emerald-100 text-emerald-700";
  if (key.includes("minería") || key.includes("mineria") || key.includes("datos")) return "bg-cyan-100 text-cyan-700";
  if (key.includes("redes")) return "bg-indigo-100 text-indigo-700";
  if (key.includes("algoritmia") || key.includes("sistemas")) return "bg-amber-100 text-amber-700";
  if (key.includes("ing") && key.includes("software")) return "bg-rose-100 text-rose-700";
  if (key.includes("seguridad") || key.includes("seginf")) return "bg-fuchsia-100 text-fuchsia-700";
  return "bg-slate-100 text-slate-700";
};

// Fecha amigable
const fmtFecha = (s) => (s ? new Date(s).toLocaleDateString() : "");

// Resalta coincidencias
function Highlight({ text, query }) {
  if (!query) return <>{text}</>;
  const q = query.trim().toLowerCase();
  if (!q) return <>{text}</>;
  const src = String(text || "");
  const idx = src.toLowerCase().indexOf(q);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {src.slice(0, idx)}
      <mark className="bg-yellow-200/70 rounded px-0.5">{src.slice(idx, idx + q.length)}</mark>
      {src.slice(idx + q.length)}
    </>
  );
}

const cx = (...xs) => xs.filter(Boolean).join(" ");
const Skeleton = ({ className = "" }) => (
  <div className={cx("animate-pulse bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 rounded-2xl", className)} />
);

/* ===== Mini design system (clases) ===== */
const btnBase = "inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium transition shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300";
const btn = cx(btnBase, "border bg-white hover:bg-slate-50 text-slate-700");
const btnGhost = cx(btnBase, "border bg-white hover:bg-slate-50 text-slate-700");
const btnPrimary = cx(btnBase, "bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 border border-indigo-600 shadow-md");
const btnPill = "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs bg-slate-100 text-slate-700";
const chip = "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] bg-slate-100 text-slate-700 hover:bg-slate-200 transition";
const inputClass = "w-full px-3 py-2 rounded-2xl border bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm";
const selectClass = "w-full px-3 py-2 rounded-2xl border bg-white outline-none focus:ring-2 focus:ring-indigo-400 shadow-sm";

/* ===== Componente ===== */

export default function Buscar() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Estado de filtros/orden/url
  const [q, setQ] = useState(() => searchParams.get("q") || "");
  const [materia, setMateria] = useState(() => searchParams.get("materia") || "");
  const [semestre, setSemestre] = useState(() => searchParams.get("semestre") || "");
  const [tag, setTag] = useState(() => searchParams.get("tag") || "");
  const [orden, setOrden] = useState(() => searchParams.get("orden") || "recientes");
  const [page, setPage] = useState(() => Number(searchParams.get("page") || 1));
  const [pageSize, setPageSize] = useState(() => Number(searchParams.get("pageSize") || 10));

  // Datos
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Búsquedas recientes
  const RECENT_KEY = "buscar:recientes";
  const recientes = useMemo(() => {
    try {
      const arr = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
      return Array.isArray(arr) ? arr.slice(0, 8) : [];
    } catch { return []; }
  }, []);

  // Sync URL
  useEffect(() => {
    const next = new URLSearchParams();
    if (q.trim()) next.set("q", q.trim());
    if (materia) next.set("materia", materia);
    if (semestre) next.set("semestre", semestre);
    if (tag) next.set("tag", tag);
    if (orden && orden !== "recientes") next.set("orden", orden);
    if (page && page !== 1) next.set("page", String(page));
    if (pageSize && pageSize !== 10) next.set("pageSize", String(pageSize));
    setSearchParams(next);
  }, [q, materia, semestre, tag, orden, page, pageSize, setSearchParams]);

  // Fetch con debounce
  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    setLoading(true); setErr("");

    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        if (materia) params.set("materia", materia);
        if (semestre) params.set("semestre", semestre);
        if (tag) params.set("tag", tag);
        params.set("_t", String(Date.now()));

        const url = `${API}/apuntes${params.toString() ? `?${params.toString()}` : ""}`;
        const r = await fetch(url, { signal: ctrl.signal });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
        const arr = Array.isArray(j) ? j : (j.apuntes || j.items || []);
        if (!alive) return;
        setItems(Array.isArray(arr) ? arr : []);
      } catch (e) {
        if (!alive || e.name === "AbortError") return;
        setErr(e.message || "No se pudo cargar el listado");
      } finally {
        if (alive) setLoading(false);
      }
    }, 250);

    return () => { alive = false; ctrl.abort(); clearTimeout(t); };
  }, [q, materia, semestre, tag]);

  // Facetas
  const materias = useMemo(() => {
    const set = new Set();
    items.forEach(a => {
      const m = a.materia || a.subject || a.materia_nombre || a.subject_name;
      if (m) set.add(String(m));
    });
    return Array.from(set).sort((a,b)=>a.localeCompare(b));
  }, [items]);

  const semestres = useMemo(() => {
    const set = new Set();
    items.forEach(a => {
      const s = a.semestre || a.semester;
      if (s) set.add(String(s));
    });
    return Array.from(set).sort((a,b)=>String(a).localeCompare(String(b), undefined, { numeric: true }));
  }, [items]);

  const tagsUniverse = useMemo(() => {
    const set = new Set();
    items.forEach(a => {
      const tags = Array.isArray(a.etiquetas || a.tags)
        ? (a.etiquetas || a.tags)
        : String(a.etiquetas || a.tags || "").split(",").map(t=>t.trim()).filter(Boolean);
      tags.forEach(t => set.add(t));
    });
    return Array.from(set).slice(0, 100).sort((a,b)=>a.localeCompare(b));
  }, [items]);

  // Filtrado/orden/paginación cliente
  const filteredAll = useMemo(() => {
    let arr = items.slice();
    const ql = q.trim().toLowerCase();
    if (ql) {
      arr = arr.filter(a => {
        const title = String(a.titulo || a.title || "").toLowerCase();
        const autor = String(a.autor || a.user || a.usuario || "").toLowerCase();
        const desc  = String(a.descripcion || a.description || "").toLowerCase();
        const tagStr = Array.isArray(a.etiquetas || a.tags)
          ? (a.etiquetas || a.tags).join(",").toLowerCase()
          : String(a.etiquetas || a.tags || "").toLowerCase();
        return title.includes(ql) || autor.includes(ql) || desc.includes(ql) || tagStr.includes(ql);
      });
    }
    if (materia) {
      arr = arr.filter(a => {
        const m = a.materia || a.subject || a.materia_nombre || a.subject_name || "";
        return String(m).toLowerCase() === String(materia).toLowerCase();
      });
    }
    if (semestre) {
      arr = arr.filter(a => String(a.semestre || a.semester || "") === String(semestre));
    }
    if (tag) {
      arr = arr.filter(a => {
        const t = Array.isArray(a.etiquetas || a.tags)
          ? (a.etiquetas || a.tags)
          : String(a.etiquetas || a.tags || "").split(",").map(x=>x.trim());
        return t.map(x=>x.toLowerCase()).includes(String(tag).toLowerCase());
      });
    }
    arr.sort((a, b) => {
      const fa = a.created_at || a.creado_en || a.fecha || a.updated_at || "";
      const fb = b.created_at || b.creado_en || b.fecha || b.updated_at || "";
      if (orden === "recientes") return new Date(fb) - new Date(fa);
      if (orden === "antiguos") return new Date(fa) - new Date(fb);
      if (orden === "tituloAZ") return String(a.titulo || a.title || "").localeCompare(String(b.titulo || b.title || ""));
      return 0;
    });
    return arr;
  }, [items, q, materia, semestre, tag, orden]);

  // Paginación
  const total = filteredAll.length;
  const [pageSafe, totalPages] = useMemo(() => {
    const tp = Math.max(1, Math.ceil(total / pageSize));
    return [Math.min(Math.max(1, page), tp), tp];
  }, [total, page, pageSize]);

  const paged = useMemo(() => {
    const start = (pageSafe - 1) * pageSize;
    return filteredAll.slice(start, start + pageSize);
  }, [filteredAll, pageSafe, pageSize]);

  // Búsquedas recientes
  const guardarBusqueda = useCallback((term) => {
    const t = String(term || "").trim();
    if (!t) return;
    try {
      const prev = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
      const next = [t, ...prev.filter(x => x !== t)].slice(0, 8);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {}
  }, []);

  const onSubmit = (e) => {
    e.preventDefault();
    guardarBusqueda(q);
    setPage(1);
  };

  const clearAll = () => {
    setQ("");
    setMateria("");
    setSemestre("");
    setTag("");
    setOrden("recientes");
    setPage(1);
    setPageSize(10);
  };

  const toggleTag = (t) => {
    setTag(t === tag ? "" : t);
    setPage(1);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
            Buscar apuntes
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Filtra por materia, semestre y etiquetas. Pulsa <kbd className="px-1 py-0.5 border rounded-lg bg-slate-50 text-[11px]">Enter</kbd> para guardar la búsqueda.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-500">Orden:</label>
          <select
            className={selectClass}
            value={orden}
            onChange={(e)=>{ setOrden(e.target.value); setPage(1); }}
          >
            <option value="recientes">Más recientes</option>
            <option value="antiguos">Más antiguos</option>
            <option value="tituloAZ">Título A–Z</option>
          </select>
        </div>
      </div>

      {/* Barra de búsqueda + filtros */}
      <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3">
        <div className="md:col-span-6">
          <input
            className={inputClass}
            placeholder="Busca por título, autor o descripción…"
            value={q}
            onChange={e => { setQ(e.target.value); setPage(1); }}
            aria-label="Buscar apuntes"
          />
          {!!recientes.length && !q && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {recientes.map((r,i)=>(
                <button
                  type="button" key={i}
                  onClick={()=>{ setQ(r); setPage(1); }}
                  className={chip}
                >
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="md:col-span-2">
          <select
            className={selectClass}
            value={materia}
            onChange={e => { setMateria(e.target.value); setPage(1); }}
            aria-label="Filtrar por materia"
          >
            <option value="">Todas las materias</option>
            {materias.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div className="md:col-span-2">
          <select
            className={selectClass}
            value={semestre}
            onChange={e => { setSemestre(e.target.value); setPage(1); }}
            aria-label="Filtrar por semestre"
          >
            <option value="">Todos los semestres</option>
            {semestres.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="md:col-span-2">
          <select
            className={selectClass}
            value={tag}
            onChange={e => { setTag(e.target.value); setPage(1); }}
            aria-label="Filtrar por etiqueta"
          >
            <option value="">Todas las etiquetas</option>
            {tagsUniverse.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </form>

      {/* Chips activos */}
      {(q || materia || semestre || tag) && (
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <span className="text-slate-500">Filtros:</span>
          {q && (
            <button onClick={()=>setQ("")} className={btn}>
              q: “{q}” ×
            </button>
          )}
          {materia && (
            <button onClick={()=>setMateria("")} className={btn}>
              materia: {materia} ×
            </button>
          )}
          {semestre && (
            <button onClick={()=>setSemestre("")} className={btn}>
              semestre: {semestre} ×
            </button>
          )}
          {tag && (
            <button onClick={()=>setTag("")} className={btn}>
              tag: #{tag} ×
            </button>
          )}
          <button onClick={clearAll} className={btnPrimary}>
            Limpiar todo
          </button>
        </div>
      )}

      {/* Estado de carga / error / lista */}
      {loading ? (
        <div className="grid gap-3">
          {[...Array(5)].map((_,i)=><Skeleton key={i} className="h-16" />)}
        </div>
      ) : err ? (
        <div className="p-4 rounded-2xl border bg-rose-50 text-rose-800">
          ⚠️ {err}
          <div className="mt-2">
            <button
              onClick={()=>{ setQ(q => q + ""); }}
              className={btnGhost}
            >
              Reintentar
            </button>
          </div>
        </div>
      ) : total === 0 ? (
        <div className="rounded-3xl border bg-white p-8 text-center shadow-sm">
          <div className="text-3xl mb-2">🧐</div>
          <div className="font-semibold">Sin resultados</div>
          <p className="text-sm text-slate-500">Prueba con otras palabras clave o filtra por materia.</p>
        </div>
      ) : (
        <>
          {/* Controles de página */}
          <div className="flex items-center justify-between text-sm text-slate-600">
            <div className="px-2 py-1 rounded-full bg-slate-50 border text-slate-700">
              Mostrando <b>{(pageSafe - 1) * pageSize + 1}</b>–<b>{Math.min(pageSafe * pageSize, total)}</b> de <b>{total}</b>
            </div>
            <div className="flex items-center gap-2">
              <label>Por página:</label>
              <select
                value={pageSize}
                onChange={(e)=>{ setPageSize(Number(e.target.value)); setPage(1); }}
                className={selectClass}
              >
                {[10, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <div className="ml-2 flex items-center gap-1">
                <button
                  disabled={pageSafe <= 1}
                  onClick={()=>setPage(p => Math.max(1, p-1))}
                  className={cx(btn, "disabled:opacity-50")}
                >‹ Anterior</button>
                <span className="px-2 py-1 rounded-full bg-white border shadow-sm">{pageSafe} / {totalPages}</span>
                <button
                  disabled={pageSafe >= totalPages}
                  onClick={()=>setPage(p => Math.min(totalPages, p+1))}
                  className={cx(btn, "disabled:opacity-50")}
                >Siguiente ›</button>
              </div>
            </div>
          </div>

          <ul className="mt-2 space-y-3">
            {paged.map((a) => {
              const id       = a.id;
              const title    = a.titulo || a.title || `Apunte #${id}`;
              const autor    = a.autor || a.user || a.usuario || "desconocido";
              const materiaN = a.materia || a.subject || a.materia_nombre || a.subject_name || "";
              const semestreN= a.semestre || a.semester || "";
              const tags     = Array.isArray(a.etiquetas || a.tags)
                ? (a.etiquetas || a.tags)
                : String(a.etiquetas || a.tags || "")
                    .split(",").map(t=>t.trim()).filter(Boolean);
              const fecha    = a.created_at || a.creado_en || a.fecha || "";

              return (
                <li key={id}>
                  <Link
                    to={`/apunte/${id}`}
                    className="group block rounded-3xl border bg-white p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow hover:border-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-500 outline-none"
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 shrink-0 grid place-items-center rounded-2xl bg-indigo-50 text-indigo-700 text-lg group-hover:bg-indigo-100 transition-colors shadow-sm">
                        📄
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-slate-900 truncate">
                            <Highlight text={title} query={q} />
                          </h3>
                          {materiaN && (
                            <span className={`text-xs px-2.5 py-0.5 rounded-full ${materiaColor(materiaN)}`}>
                              {materiaN}
                            </span>
                          )}
                          {semestreN && (
                            <span className={btnPill}>
                              Sem {semestreN}
                            </span>
                          )}
                        </div>

                        {(a.descripcion || a.description) && (
                          <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                            <Highlight text={a.descripcion || a.description} query={q} />
                          </p>
                        )}

                        {tags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {tags.slice(0, 6).map((t, i) => (
                              <button
                                type="button"
                                key={i}
                                onClick={(ev)=>{ ev.preventDefault(); toggleTag(t); }}
                                className={cx(
                                  "text-[11px] px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 transition shadow-sm",
                                  String(t).toLowerCase() === String(tag).toLowerCase() && "ring-2 ring-indigo-300"
                                )}
                                title={`Filtrar por #${t}`}
                              >
                                #{t}
                              </button>
                            ))}
                            {tags.length > 6 && (
                              <span className="text-[11px] px-2.5 py-1 rounded-full bg-slate-50 text-slate-500">
                                +{tags.length - 6}
                              </span>
                            )}
                          </div>
                        )}

                        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                          <div className="flex items-center gap-3">
                            <span>Autor: <b className="text-slate-700"><Highlight text={autor} query={q} /></b></span>
                            {fecha && <span className="hidden sm:inline">· {fmtFecha(fecha)}</span>}
                          </div>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 text-indigo-700">
                              Ver <span aria-hidden>→</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Footer de paginación */}
          <div className="flex items-center justify-between text-sm text-slate-600 pt-2">
            <div className="px-2 py-1 rounded-full bg-slate-50 border text-slate-700">
              Mostrando <b>{(pageSafe - 1) * pageSize + 1}</b>–<b>{Math.min(pageSafe * pageSize, total)}</b> de <b>{total}</b>
            </div>
            <div className="flex items-center gap-1">
              <button
                disabled={pageSafe <= 1}
                onClick={()=>setPage(p => Math.max(1, p-1))}
                className={cx(btn, "disabled:opacity-50")}
              >‹ Anterior</button>
              <button
                disabled={pageSafe >= totalPages}
                onClick={()=>setPage(p => Math.min(totalPages, p+1))}
                className={cx(btn, "disabled:opacity-50")}
              >Siguiente ›</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
