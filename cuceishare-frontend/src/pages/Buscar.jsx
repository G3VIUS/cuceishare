// src/pages/Buscar.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";

const API =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  process.env.REACT_APP_API_URL ||
  "http://localhost:3001";

/* ================= Helpers ================= */

// Aliases de materias: frontend/urls -> slug esperado por el backend
const MATERIA_ALIAS = {
  // Minería
  "mineria-datos": "mineria",
  "mineria": "mineria",

  // Ingeniería de Software
  "ingsoft": "isw",
  "ingenieria-software": "isw",
  "isw": "isw",

  // Estructuras de Datos I
  "ed1": "ed1",
  "estructuras-de-datos-i": "ed1",
  "estructuras": "ed1",

  // Administración de Servidores
  "administracion-servidores": "aserv",
  "aserv": "aserv",

  // Otras materias comunes
  "redes": "redes",
  "algoritmia": "algoritmia",
  "seginf": "seginf",
  "seguridad-informacion": "seginf",
  "teoria": "teoria",
  "teoria-de-la-computacion": "teoria",
  "programacion": "programacion",
};

const MATERIAS_CATALOG = [
  { value: "ed1",          label: "Estructuras de Datos I" },
  { value: "aserv",        label: "Administración de Servidores" },
  { value: "mineria",      label: "Minería de Datos" },
  { value: "redes",        label: "Redes" },
  { value: "algoritmia",   label: "Algoritmia" },
  { value: "isw",          label: "Ingeniería de Software" },
  { value: "seginf",       label: "Seguridad de la Información" },
  { value: "teoria",       label: "Teoría de la Computación" },
  { value: "programacion", label: "Programación" },
];

const materiaLabel = (slug) =>
  MATERIAS_CATALOG.find((m) => m.value === slug)?.label || slug;

const normalizeMateria = (m) => {
  if (!m) return "";
  const k = String(m).toLowerCase().trim();
  return MATERIA_ALIAS[k] || k;
};

// Clase de color por slug canónico
const materiaColor = (slug) => {
  const s = normalizeMateria(slug);
  switch (s) {
    case "ed1":           return "bg-violet-100 text-violet-700";
    case "aserv":         return "bg-emerald-100 text-emerald-700";
    case "mineria":       return "bg-cyan-100 text-cyan-700";
    case "redes":         return "bg-indigo-100 text-indigo-700";
    case "algoritmia":    return "bg-amber-100 text-amber-700";
    case "isw":           return "bg-rose-100 text-rose-700";
    case "seginf":        return "bg-fuchsia-100 text-fuchsia-700";
    case "teoria":        return "bg-blue-100 text-blue-700";
    case "programacion":  return "bg-sky-100 text-sky-700";
    default:              return "bg-slate-100 text-slate-700";
  }
};

// Fecha amigable
const fmtFecha = (s) => (s ? new Date(s).toLocaleDateString() : "");

// Resalta coincidencias simples
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
      <mark className="bg-yellow-200/70 rounded px-0.5">
        {src.slice(idx, idx + q.length)}
      </mark>
      {src.slice(idx + q.length)}
    </>
  );
}

const cx = (...xs) => xs.filter(Boolean).join(" ");
const Skeleton = ({ className = "" }) => (
  <div className={cx("animate-pulse bg-slate-200 rounded-2xl", className)} />
);

/* ===== Mini design system ===== */
const btnBase =
  "inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium transition shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300";
const btn = cx(btnBase, "border bg-white hover:bg-slate-50 text-slate-700");
const btnGhost = cx(btnBase, "border bg-white hover:bg-slate-50 text-slate-700");
const btnPrimary = cx(
  btnBase,
  "bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 border border-indigo-600 shadow-md"
);
const btnPill =
  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs bg-slate-100 text-slate-700";
const chip =
  "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] bg-slate-100 text-slate-700 hover:bg-slate-200 transition";
const inputClass =
  "w-full px-3 py-2 rounded-2xl border bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm";
const selectClass =
  "w-full px-3 py-2 rounded-2xl border bg-white outline-none focus:ring-2 focus:ring-indigo-400 shadow-sm";

/* ==== clave compartida para búsquedas recientes (UNA sola vez) ==== */
const RECENT_KEY = "buscar:recientes";

/* ================= Componente ================= */

export default function Buscar() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Token opcional (si el backend lo requiere para /apuntes)
  const token = useMemo(() => localStorage.getItem("token") || "", []);
  const HEADERS = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  // Estado — inicializa desde la URL (conserva filtros entrantes)
  const [q, setQ] = useState(() => searchParams.get("q") || "");
  const [materia, setMateria] = useState(() => normalizeMateria(searchParams.get("materia") || ""));
  const [tag, setTag] = useState(() => searchParams.get("tag") || "");
  const [orden, setOrden] = useState(() => searchParams.get("orden") || "recientes");
  const [page, setPage] = useState(() => Number(searchParams.get("page") || 1));
  const [pageSize, setPageSize] = useState(() => Number(searchParams.get("pageSize") || 10));

  // Si cambian los searchParams (navegación atrás/adelante), sincroniza estado
  useEffect(() => {
    const qp = searchParams.get("q") || "";
    if (qp !== q) setQ(qp);

    const m = normalizeMateria(searchParams.get("materia") || "");
    if (m !== materia) setMateria(m);

    const t = searchParams.get("tag") || "";
    if (t !== tag) setTag(t);

    const o = searchParams.get("orden") || "recientes";
    if (o !== orden) setOrden(o);

    const p = Number(searchParams.get("page") || 1);
    if (p !== page) setPage(p);

    const ps = Number(searchParams.get("pageSize") || 10);
    if (ps !== pageSize) setPageSize(ps);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Datos
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Búsquedas recientes
  const recientes = useMemo(() => {
    try {
      const arr = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
      return Array.isArray(arr) ? arr.slice(0, 8) : [];
    } catch {
      return [];
    }
  }, []);

  // Sincroniza URL con el estado actual (slugs normalizados)
  useEffect(() => {
    const next = new URLSearchParams();
    if (q.trim()) next.set("q", q.trim());
    if (materia) next.set("materia", normalizeMateria(materia));
    if (tag) next.set("tag", tag);
    if (orden && orden !== "recientes") next.set("orden", orden);
    if (page && page !== 1) next.set("page", String(page));
    if (pageSize && pageSize !== 10) next.set("pageSize", String(pageSize));
    setSearchParams(next, { replace: true });
  }, [q, materia, tag, orden, page, pageSize, setSearchParams]);

  // Fetch con debounce (pasa materia normalizada al backend)
  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    setLoading(true);
    setErr("");

    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        if (materia) params.set("materia", normalizeMateria(materia));
        if (tag) params.set("tag", tag);
        params.set("_t", String(Date.now()));

        const url = `${API}/apuntes${params.toString() ? `?${params.toString()}` : ""}`;
        const r = await fetch(url, { signal: ctrl.signal, headers: HEADERS });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);

        const arr = Array.isArray(j) ? j : j.apuntes || j.items || j.rows || [];
        if (!alive) return;
        setItems(Array.isArray(arr) ? arr : []);
      } catch (e) {
        if (!alive || e.name === "AbortError") return;
        setErr(e.message || "No se pudo cargar el listado");
      } finally {
        if (alive) setLoading(false);
      }
    }, 250);

    return () => {
      alive = false;
      ctrl.abort();
      clearTimeout(t);
    };
  }, [q, materia, tag, HEADERS]);

  // Facetas (materias: catálogo fijo + las detectadas en resultados)
  const materiasFromItems = useMemo(() => {
    const set = new Set();
    items.forEach((a) => {
      const raw =
        a.subject_slug || a.materia_slug ||
        a.materia || a.subject || a.materia_nombre || a.subject_name || "";
      const slug = normalizeMateria(raw);
      if (slug) set.add(slug);
    });
    return Array.from(set);
  }, [items]);

  const materiasSelect = useMemo(() => {
    const base = [...MATERIAS_CATALOG.map((m) => m.value)];
    const merged = Array.from(new Set([...base, ...materiasFromItems]));
    return merged
      .map((v) => ({ value: v, label: materiaLabel(v) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [materiasFromItems]);

  const tagsUniverse = useMemo(() => {
    const set = new Set();
    items.forEach((a) => {
      const tags = Array.isArray(a.etiquetas || a.tags)
        ? a.etiquetas || a.tags
        : String(a.etiquetas || a.tags || "")
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
      tags.forEach((t) => set.add(t));
    });
    return Array.from(set).slice(0, 100).sort((a, b) => a.localeCompare(b));
  }, [items]);

  // Filtrado/orden/paginación cliente
  const filteredAll = useMemo(() => {
    let arr = items.slice();

    const ql = q.trim().toLowerCase();
    if (ql) {
      arr = arr.filter((a) => {
        const title = String(a.titulo || a.title || "").toLowerCase();
        const autor = String(a.autor || a.user || a.usuario || "").toLowerCase();
        const desc = String(a.descripcion || a.description || "").toLowerCase();
        const tagStr = Array.isArray(a.etiquetas || a.tags)
          ? (a.etiquetas || a.tags).join(",").toLowerCase()
          : String(a.etiquetas || a.tags || "").toLowerCase();
        return (
          title.includes(ql) ||
          autor.includes(ql) ||
          desc.includes(ql) ||
          tagStr.includes(ql)
        );
      });
    }

    if (materia) {
      arr = arr.filter((a) => {
        const raw =
          a.subject_slug || a.materia_slug ||
          a.materia || a.subject || a.materia_nombre || a.subject_name || "";
        return normalizeMateria(raw) === normalizeMateria(materia);
      });
    }

    if (tag) {
      arr = arr.filter((a) => {
        const t = Array.isArray(a.etiquetas || a.tags)
          ? a.etiquetas || a.tags
          : String(a.etiquetas || a.tags || "")
              .split(",")
              .map((x) => x.trim());
        return t.map((x) => x.toLowerCase()).includes(String(tag).toLowerCase());
      });
    }

    arr.sort((a, b) => {
      const fa = a.created_at || a.creado_en || a.fecha || a.updated_at || "";
      const fb = b.created_at || b.creado_en || b.fecha || b.updated_at || "";
      if (orden === "recientes") return new Date(fb) - new Date(fa);
      if (orden === "antiguos") return new Date(fa) - new Date(fb);
      if (orden === "tituloAZ")
        return String(a.titulo || a.title || "").localeCompare(
          String(b.titulo || b.title || "")
        );
      return 0;
    });

    return arr;
  }, [items, q, materia, tag, orden]);

  // Paginación
  const total = filteredAll.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageSafe = Math.min(Math.max(1, page), totalPages);

  const paged = useMemo(() => {
    const start = (pageSafe - 1) * pageSize;
    return filteredAll.slice(start, start + pageSize);
  }, [filteredAll, pageSafe, pageSize]);

  // Guardar búsqueda (usa la constante RECENT_KEY declarada arriba)
  const guardarBusqueda = useCallback((term) => {
    const t = String(term || "").trim();
    if (!t) return;
    try {
      const prev = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
      const next = [t, ...prev.filter((x) => x !== t)].slice(0, 8);
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
    setTag("");
    setOrden("recientes");
    setPage(1);
    setPageSize(10);
  };

  const toggleTag = (t) => {
    setTag(t === tag ? "" : t);
    setPage(1);
  };

  /* ================== Render ================== */

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
            Buscar apuntes
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Filtra por materia y etiquetas. Pulsa{" "}
            <kbd className="px-1 py-0.5 border rounded-lg bg-slate-50 text-[11px]">
              Enter
            </kbd>{" "}
            para guardar la búsqueda.
          </p>
        </div>

        {/* Toolbar derecha: Orden + Limpiar */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-500">Orden:</label>
          <select
            className={selectClass}
            value={orden}
            onChange={(e) => {
              setOrden(e.target.value);
              setPage(1);
            }}
          >
            <option value="recientes">Más recientes</option>
            <option value="antiguos">Más antiguos</option>
            <option value="tituloAZ">Título A–Z</option>
          </select>
          <button onClick={clearAll} className={btn}>
            Limpiar filtros
          </button>
        </div>
      </div>

      {/* Barra de búsqueda + filtros (sin semestre ni blockId) */}
      <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3">
        <div className="md:col-span-7">
          <input
            className={inputClass}
            placeholder="Busca por título, autor o descripción…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            aria-label="Buscar apuntes"
          />
          {!!recientes.length && !q && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {recientes.map((r, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => {
                    setQ(r);
                    setPage(1);
                  }}
                  className={chip}
                >
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="md:col-span-3">
          <select
            className={selectClass}
            value={materia}
            onChange={(e) => {
              setMateria(normalizeMateria(e.target.value));
              setPage(1);
            }}
            aria-label="Filtrar por materia"
          >
            <option value="">Todas las materias</option>
            {materiasSelect.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <select
            className={selectClass}
            value={tag}
            onChange={(e) => {
              setTag(e.target.value);
              setPage(1);
            }}
            aria-label="Filtrar por etiqueta"
          >
            <option value="">Todas las etiquetas</option>
            {tagsUniverse.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </form>

      {/* Chips activos (sin semestre ni blockId) */}
      {(q || materia || tag) && (
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <span className="text-slate-500">Filtros:</span>
          {q && (
            <button onClick={() => setQ("")} className={btn}>
              q: “{q}” ×
            </button>
          )}
          {materia && (
            <button onClick={() => setMateria("")} className={btn}>
              materia: {materiaLabel(materia)} ×
            </button>
          )}
          {tag && (
            <button onClick={() => setTag("")} className={btn}>
              tag: #{tag} ×
            </button>
          )}
        </div>
      )}

      {/* Estado de carga / error / lista */}
      {loading ? (
        <div className="grid gap-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : err ? (
        <div className="p-4 rounded-2xl border bg-rose-50 text-rose-800">
          ⚠️ {err}
          <div className="mt-2">
            <button
              onClick={() => setQ((v) => v + "")}
              className={btnGhost}
            >
              Reintentar
            </button>
          </div>
        </div>
      ) : filteredAll.length === 0 ? (
        <div className="rounded-3xl border bg-white p-8 text-center shadow-sm">
          <div className="text-3xl mb-2">🧐</div>
          <div className="font-semibold">Sin resultados</div>
          <p className="text-sm text-slate-500">
            Prueba con otras palabras clave o filtra por materia.
          </p>
        </div>
      ) : (
        <>
          {/* Controles de página */}
          <div className="flex items-center justify-between text-sm text-slate-600">
            <div className="px-2 py-1 rounded-full bg-slate-50 border text-slate-700">
              Mostrando <b>{(pageSafe - 1) * pageSize + 1}</b>–<b>{Math.min(pageSafe * pageSize, filteredAll.length)}</b> de <b>{filteredAll.length}</b>
            </div>
            <div className="flex items-center gap-2">
              <label>Por página:</label>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className={selectClass}
              >
                {[10, 20, 50].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <div className="ml-2 flex items-center gap-1">
                <button
                  disabled={pageSafe <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className={cx(btn, "disabled:opacity-50")}
                >
                  ‹ Anterior
                </button>
                <span className="px-2 py-1 rounded-full bg-white border shadow-sm">
                  {pageSafe} / {Math.max(1, Math.ceil(filteredAll.length / pageSize))}
                </span>
                <button
                  disabled={pageSafe >= Math.max(1, Math.ceil(filteredAll.length / pageSize))}
                  onClick={() => setPage((p) => Math.min(Math.max(1, Math.ceil(filteredAll.length / pageSize)), p + 1))}
                  className={cx(btn, "disabled:opacity-50")}
                >
                  Siguiente ›
                </button>
              </div>
            </div>
          </div>

          <ul className="mt-2 space-y-3">
            {paged.map((a) => {
              const id = a.id;
              const title = a.titulo || a.title || `Apunte #${id}`;
              const autor = a.autor || a.user || a.usuario || "desconocido";
              const mraw =
                a.subject_slug || a.materia_slug ||
                a.materia || a.subject || a.materia_nombre || a.subject_name || "";
              const mslug = normalizeMateria(mraw);
              const mlabel = materiaLabel(mslug);
              const semestreN = a.semestre || a.semester || ""; // solo mostrar, ya no filtra
              const tags = Array.isArray(a.etiquetas || a.tags)
                ? a.etiquetas || a.tags
                : String(a.etiquetas || a.tags || "")
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean);
              const fecha = a.created_at || a.creado_en || a.fecha || "";

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
                          {mslug && (
                            <span className={`text-xs px-2.5 py-0.5 rounded-full ${materiaColor(mslug)}`}>
                              {mlabel}
                            </span>
                          )}
                          {semestreN && (
                            <span className={btnPill}>Sem {semestreN}</span>
                          )}
                        </div>

                        {(a.descripcion || a.description) && (
                          <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                            <Highlight
                              text={a.descripcion || a.description}
                              query={q}
                            />
                          </p>
                        )}

                        {tags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {tags.slice(0, 6).map((t, i) => (
                              <button
                                type="button"
                                key={i}
                                onClick={(ev) => {
                                  ev.preventDefault();
                                  toggleTag(t);
                                }}
                                className={cx(
                                  "text-[11px] px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 transition shadow-sm",
                                  String(t).toLowerCase() ===
                                    String(tag).toLowerCase() && "ring-2 ring-indigo-300"
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
                            <span>
                              Autor:{" "}
                              <b className="text-slate-700">
                                <Highlight text={autor} query={q} />
                              </b>
                            </span>
                            {fecha && (
                              <span className="hidden sm:inline">· {fmtFecha(fecha)}</span>
                            )}
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
        </>
      )}
    </div>
  );
}
