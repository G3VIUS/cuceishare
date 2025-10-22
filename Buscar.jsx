// src/pages/Buscar.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import ResourceList from "./ResourceList";

const API =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  process.env.REACT_APP_API_URL ||
  "http://localhost:3001";

/* ===== Helpers ===== */

// Paleta por materia (solo decorativo en tarjetas de apuntes)
const materiaColor = (m) => {
  if (!m) return "bg-slate-100 text-slate-700";
  const key = String(m).toLowerCase();
  if (key.includes("estructuras")) return "bg-violet-100 text-violet-700";
  if (key.includes("servidores"))  return "bg-emerald-100 text-emerald-700";
  if (key.includes("datos"))       return "bg-cyan-100 text-cyan-700";
  if (key.includes("red"))         return "bg-indigo-100 text-indigo-700";
  if (key.includes("sistemas"))    return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
};

// Fecha amigable
const fmtFecha = (s) => (s ? new Date(s).toLocaleDateString() : "");

// slugify simple (quita tildes, pasa a minúsculas, reemplaza espacios por guiones)
const slugify = (s) =>
  String(s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

// Mapeo de nombres comunes → slugs usados en la tabla `recursos.subject_slug`
const MATERIA_TO_SLUG = {
  // Estructuras de Datos I
  "estructuras-de-datos-i": "ed1",
  "estructuras-de-datos":   "ed1",
  "ed1": "ed1",

  // Administración de Servidores
  "administracion-de-servidores": "aserv",
  "administracion-de-servidores-i": "aserv",
  "aserv": "aserv",

  // Minería de Datos
  "mineria-de-datos": "mineria",
  "mineria": "mineria",

  // Redes
  "redes": "redes",

  // Algoritmia
  "algoritmia": "algoritmia",

  // Teoría de la Computación
  "teoria-de-la-computacion": "teoria",
  "teoria": "teoria",

  // Programación
  "programacion": "programacion",

  // Ingeniería de Software
  "ingenieria-de-software": "ingsoft",
  "ingsoft": "ingsoft",

  // Seguridad informática
  "seguridad-de-la-informacion": "seginf",
  "seguridad-informatica": "seginf",
  "seginf": "seginf",
};

// Normaliza el valor de ?materia= (si viene nombre largo, lo convierte a slug oficial)
const materiaToSlug = (m) => {
  const key = slugify(m);
  return MATERIA_TO_SLUG[key] || key; // si ya viene 'ed1', 'aserv', etc. lo deja igual
};

/* ===== Componente ===== */
export default function Buscar() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // materia desde la URL, p.ej. /buscar?materia=ed1
  const [params] = useSearchParams();
  const materiaParam = (params.get("materia") || "").trim();
  const materiaSlug = materiaToSlug(materiaParam);

  // Cargar apuntes
  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const r = await fetch(`${API}/apuntes`);
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
        const arr = Array.isArray(j) ? j : (j.apuntes || j.items || []);
        setItems(arr);
      } catch (e) {
        setErr(e.message || "No se pudo cargar el listado");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((a) =>
      String(a.titulo || a.title || "").toLowerCase().includes(s) ||
      String(a.autor || a.user || a.usuario || "").toLowerCase().includes(s)
    );
  }, [q, items]);

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <h1 className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
        Buscar apuntes
      </h1>

      <input
        className="w-full px-3 py-2 rounded-lg border focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
        placeholder="Busca por título o autor…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Buscar apuntes"
      />

      {loading ? (
        <div className="grid gap-3">
          <div className="h-16 rounded-2xl bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 animate-pulse" />
          <div className="h-16 rounded-2xl bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 animate-pulse" />
          <div className="h-16 rounded-2xl bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 animate-pulse" />
        </div>
      ) : err ? (
        <div className="p-4 rounded-2xl border bg-rose-50 text-rose-800">⚠️ {err}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border bg-white p-8 text-center">
          <div className="text-3xl mb-2">🧐</div>
          <div className="font-semibold">Sin resultados</div>
          <p className="text-sm text-slate-500">
            Prueba con otras palabras clave o filtra por materia.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((a) => {
            const id = a.id;
            const title = a.titulo || a.title || `Apunte #${id}`;
            const autor = a.autor || a.user || a.usuario || "desconocido";
            const mat   = a.materia || a.subject || "";
            const semestre = a.semestre || a.semester || "";
            const tags = Array.isArray(a.etiquetas || a.tags)
              ? (a.etiquetas || a.tags)
              : String(a.etiquetas || a.tags || "")
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean);
            const fecha = a.created_at || a.creado_en || a.fecha || "";

            return (
              <li key={id}>
                <Link
                  to={`/apuntes/${id}`}
                  className="group block rounded-2xl border bg-white p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow hover:border-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-500 outline-none"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 shrink-0 grid place-items-center rounded-xl bg-indigo-50 text-indigo-700 text-lg group-hover:bg-indigo-100 transition-colors">
                      📄
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-slate-900 truncate">
                          {title}
                        </h3>
                        {mat && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${materiaColor(mat)}`}
                          >
                            {mat}
                          </span>
                        )}
                        {semestre && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            Sem {semestre}
                          </span>
                        )}
                      </div>

                      {(a.descripcion || a.description) && (
                        <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                          {a.descripcion || a.description}
                        </p>
                      )}

                      {tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {tags.slice(0, 6).map((t, i) => (
                            <span
                              key={i}
                              className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600"
                            >
                              #{t}
                            </span>
                          ))}
                          {tags.length > 6 && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-500">
                              +{tags.length - 6}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                        <div className="flex items-center gap-3">
                          <span>
                            Autor: <b className="text-slate-700">{autor}</b>
                          </span>
                          {fecha && (
                            <span className="hidden sm:inline">
                              · {fmtFecha(fecha)}
                            </span>
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
      )}

      {/* Recursos por materia (usa el slug normalizado de ?materia=) */}
      {materiaSlug && (
        <section className="mt-12">
          <h2 className="text-lg font-semibold mb-3">Recursos recomendados</h2>
          <ResourceList materiaSlug={materiaSlug} />
        </section>
      )}
    </div>
  );
}
