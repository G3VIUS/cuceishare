// src/pages/EditApunte.jsx
import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";

const API =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  process.env.REACT_APP_API_URL ||
  "http://localhost:3001";

/** Ajusta los slugs a los reales de tu DB */
const SUBJECTS = [
  { name: "Estructuras de Datos I", value: "ed1" },
  { name: "Administración de Servidores", value: "aserv" },
  { name: "Minería de Datos", value: "mineria" },
  { name: "Redes", value: "redes" },
  { name: "Algoritmia", value: "algoritmia" },
  { name: "Programación", value: "programacion" },
  { name: "Ingeniería de Software", value: "isw" },
  { name: "Seguridad de la Información", value: "seguridad" },
  { name: "Teoría de la Computación", value: "teoria" },
];

const ACCEPTED = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/png",
  "image/jpeg",
  "text/plain",
];
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

export default function EditApunte() {
  const { id } = useParams();
  const navigate = useNavigate();

  const token = localStorage.getItem("token");
  const authHeader = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const [form, setForm] = useState({
    titulo: "",
    descripcion: "",
    subject_slug: "",
    block_id: "",
    tagsCsv: "",
    visibilidad: "public",
  });

  // archivo seleccionado (opcional)
  const [file, setFile] = useState(null);
  const fileInputRef = useRef(null);

  // bloques (según materia)
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [blocksErr, setBlocksErr] = useState("");
  const [blocks, setBlocks] = useState([]); // [{id, titulo, code, orden}]

  // === Cargar apunte
  useEffect(() => {
    let alive = true;
    const ac = new AbortController();

    (async () => {
      setLoading(true);
      setError("");
      try {
        const r = await fetch(`${API}/apuntes/${id}`, {
          headers: authHeader,
          signal: ac.signal,
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);

        if (!alive) return;

        const tagsArray = Array.isArray(j.tags)
          ? j.tags
          : typeof j.tags === "string"
          ? j.tags.split(",").map((s) => s.trim()).filter(Boolean)
          : [];

        setForm({
          titulo: j.titulo ?? "",
          descripcion: j.descripcion ?? "",
          subject_slug: j.subject_slug ?? "",
          block_id: j.block_id ?? "",
          tagsCsv: tagsArray.join(", "),
          visibilidad: j.visibilidad ?? "public",
        });

        if (j.subject_slug) {
          fetchBlocks(j.subject_slug, ac.signal, () => alive);
        }
      } catch (e) {
        if (e.name === "AbortError") return;
        setError(e.message || "No se pudo cargar el apunte");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
      ac.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authHeader, id]);

  // === Cargar bloques al cambiar materia
  useEffect(() => {
    if (!form.subject_slug) {
      setBlocks([]);
      setForm((prev) => ({ ...prev, block_id: "" }));
      return;
    }
    const ac = new AbortController();
    let alive = true;
    fetchBlocks(form.subject_slug, ac.signal, () => alive);
    return () => {
      alive = false;
      ac.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.subject_slug]);

  /** Intenta /blocks y si 404, /api/blocks. Normaliza a {id,titulo,code,orden} */
  async function fetchBlocks(subjectSlug, signal, isAliveFn = () => true) {
    const urlA = `${API}/blocks?subject=${encodeURIComponent(subjectSlug)}`;
    const urlB = `${API}/api/blocks?subject=${encodeURIComponent(subjectSlug)}`;
    try {
      setBlocksLoading(true);
      setBlocksErr("");

      let r = await fetch(urlA, { headers: authHeader, signal });
      if (r.status === 404) {
        r = await fetch(urlB, { headers: authHeader, signal });
      }
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);

      if (!isAliveFn()) return;

      const raw = Array.isArray(j?.items) ? j.items : Array.isArray(j) ? j : [];
      const arr = raw.map((b) => ({
        id: b.id,
        titulo: b.titulo || b.title || b.code || "Bloque",
        code: b.code ?? null,
        orden: Number.isFinite(b.orden) ? b.orden : null,
      }));
      arr.sort(
        (a, b) =>
          (a.orden ?? 999) - (b.orden ?? 999) ||
          String(a.titulo || "").localeCompare(String(b.titulo || ""))
      );

      setBlocks(arr);
    } catch (e) {
      if (e.name === "AbortError") return;
      setBlocksErr(e.message || "No se pudieron cargar los bloques");
      setBlocks([]);
    } finally {
      setBlocksLoading(false);
    }
  }

  function onChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (error) setError("");
    if (saved) setSaved("");
  }

  // === Drag & Drop ===
  function onPick(e) {
    const f = e.target.files?.[0];
    if (f) validateAndSetFile(f);
  }
  function onDrop(e) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) validateAndSetFile(f);
  }
  function onDragOver(e) {
    e.preventDefault();
  }

  function validateAndSetFile(f) {
    if (f.size > MAX_BYTES) {
      setError("El archivo supera 25 MB.");
      return;
    }
    if (ACCEPTED.length && f.type && !ACCEPTED.includes(f.type)) {
      setError("Tipo de archivo no permitido.");
      return;
    }
    setError("");
    setFile(f);
  }

  async function onSave(e) {
    e?.preventDefault?.();
    setError("");
    setSaved("");

    if (!form.titulo.trim()) {
      setError("El título es requerido");
      return;
    }

    try {
      setSaving(true);

      const tags = form.tagsCsv
        ? form.tagsCsv.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

      let r, j;

      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("titulo", form.titulo);
        fd.append("descripcion", form.descripcion);
        if (form.subject_slug) fd.append("subject_slug", form.subject_slug);
        if (form.block_id) fd.append("block_id", form.block_id);
        fd.append("visibilidad", form.visibilidad || "public");
        fd.append("tags", JSON.stringify(tags));

        r = await fetch(`${API}/apuntes/${id}`, {
          method: "PUT",
          headers: authHeader, // NO Content-Type manual
          body: fd,
        });
      } else {
        const payload = {
          titulo: form.titulo,
          descripcion: form.descripcion,
          subject_slug: form.subject_slug || null,
          block_id: form.block_id || null,
          visibilidad: form.visibilidad || "public",
          tags,
        };
        r = await fetch(`${API}/apuntes/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...authHeader },
          body: JSON.stringify(payload),
        });
      }

      j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);

      setSaved("Guardado correctamente");
      navigate("/perfil", { replace: true });
    } catch (e) {
      setError(e.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!window.confirm("¿Eliminar este apunte? Esta acción no se puede deshacer.")) return;
    try {
      setDeleting(true);
      const r = await fetch(`${API}/apuntes/${id}`, {
        method: "DELETE",
        headers: authHeader,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      navigate("/perfil", { replace: true });
    } catch (e) {
      setError(e.message || "No se pudo eliminar");
    } finally {
      setDeleting(false);
    }
  }

  async function abrirArchivoActual() {
    try {
      const r = await fetch(`${API}/apuntes/${id}/url?_t=${Date.now()}`, {
        headers: authHeader,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      if (j?.url) {
        window.open(j.url, "_blank", "noopener,noreferrer");
      } else {
        alert("Este apunte no tiene archivo disponible.");
      }
    } catch (e) {
      alert("No se pudo abrir el archivo.");
    }
  }

  if (loading) return <div className="p-6">Cargando…</div>;

  // Nombre del bloque actualmente seleccionado (solo display)
  const currentBlockName =
    blocks.find((b) => b.id === form.block_id)?.titulo || "";

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-extrabold flex items-center gap-2">
          <span>✏️</span> Editar Apunte
        </h1>
        <button
          type="button"
          onClick={abrirArchivoActual}
          className="px-3 py-2 rounded-xl border bg-white hover:bg-slate-50 text-sm"
          title="Abrir archivo actual"
        >
          📂 Abrir archivo
        </button>
      </div>

      {(error || saved) && (
        <div
          className={`p-3 rounded-xl border ${
            error ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-800"
          }`}
        >
          {error || saved}
        </div>
      )}

      <form
        onSubmit={onSave}
        className="grid gap-4 bg-white p-5 rounded-2xl border shadow-sm"
      >
        {/* Campos principales */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Título *</label>
          <input
            name="titulo"
            value={form.titulo}
            onChange={onChange}
            className="w-full px-3 py-2 rounded-lg border"
            placeholder="Ej. Árboles binarios de búsqueda"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Descripción</label>
          <textarea
            name="descripcion"
            value={form.descripcion}
            onChange={onChange}
            rows={5}
            className="w-full px-3 py-2 rounded-lg border"
            placeholder="Resumen, contenidos, etc."
          />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Materia</label>
            <select
              name="subject_slug"
              value={form.subject_slug}
              onChange={onChange}
              className="w-full px-3 py-2 rounded-lg border bg-white"
            >
              <option value="">— Selecciona —</option>
              {SUBJECTS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              Se guardará el slug real en <code>subject_slug</code>.
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Visibilidad</label>
            <select
              name="visibilidad"
              value={form.visibilidad}
              onChange={onChange}
              className="w-full px-3 py-2 rounded-lg border bg-white"
            >
              <option value="public">Pública</option>
              <option value="private">Privada</option>
            </select>
          </div>
        </div>

        {/* Bloque */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Bloque (opcional)</label>
          <div className="grid sm:grid-cols-[1fr_auto] gap-2">
            <select
              name="block_id"
              value={form.block_id || ""}
              onChange={onChange}
              className="w-full px-3 py-2 rounded-lg border bg-white"
              disabled={!form.subject_slug || blocksLoading}
            >
              <option value="">{blocksLoading ? "Cargando…" : "— Sin bloque —"}</option>
              {blocks.map((b) => (
                <option key={b.id} value={b.id}>
                  {/* 👇 Mostrar SIEMPRE el nombre completo del bloque */}
                  {b.titulo}
                  {Number.isFinite(b.orden) ? ` · #${b.orden}` : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => fetchBlocks(form.subject_slug, undefined, () => true)}
              className="px-3 py-2 rounded-lg border bg-white hover:bg-slate-50"
              disabled={!form.subject_slug || blocksLoading}
              title="Recargar bloques"
            >
              🔄
            </button>
          </div>
          {!!currentBlockName && (
            <div className="text-xs text-slate-600">
              Seleccionado: <span className="font-medium">{currentBlockName}</span>
            </div>
          )}
          {blocksErr && (
            <div className="text-xs text-rose-700">⚠️ {blocksErr}</div>
          )}
          <p className="text-xs text-slate-500">
            Se guardará el <code>UUID</code> del bloque en <code>block_id</code>.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Etiquetas (separadas por coma)</label>
          <input
            name="tagsCsv"
            value={form.tagsCsv}
            onChange={onChange}
            className="w-full px-3 py-2 rounded-lg border"
            placeholder="árboles, ABB, AVL"
          />
        </div>

        {/* Área de archivo */}
        <div className="grid md:grid-cols-[1fr_220px] gap-4">
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            className="rounded-2xl border-2 border-dashed border-slate-300 p-6 text-center"
          >
            <div className="text-3xl">📎</div>
            <div className="mt-2 font-medium">Arrastra tu archivo aquí</div>
            <div className="text-slate-400 text-sm my-1">o</div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2 rounded-lg border bg-white hover:bg-slate-50"
            >
              Elegir archivo
            </button>
            <input
              ref={fileInputRef}
              type="file"
              onChange={onPick}
              accept={ACCEPTED.join(",")}
              className="hidden"
            />
            <div className="mt-3 text-xs text-slate-500">
              Formatos aceptados: PDF, DOC/DOCX, PPT/PPTX, PNG, JPG, TXT. Límite 25 MB.
            </div>

            {file && (
              <div className="mt-3 p-3 rounded-xl bg-slate-50 border text-left text-sm">
                <div className="font-medium">Seleccionado:</div>
                <div className="truncate">{file.name}</div>
                <div className="text-slate-500">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="mt-2 px-2 py-1 rounded-lg border bg-white hover:bg-slate-50 text-xs"
                >
                  Quitar
                </button>
              </div>
            )}
          </div>

          <aside className="p-4 rounded-2xl border bg-slate-50 text-sm">
            <div className="font-semibold mb-2">Consejos</div>
            <ul className="list-disc pl-4 space-y-1 text-slate-700">
              <li>Prefiere PDF para mayor compatibilidad.</li>
              <li>Describe el contenido y agrega etiquetas.</li>
            </ul>
          </aside>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className={`px-4 py-2 rounded-xl text-white font-semibold ${
              saving ? "bg-green-400" : "bg-green-600 hover:bg-green-700"
            }`}
          >
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 rounded-xl border bg-white hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={onDelete}
            className={`px-4 py-2 rounded-xl ${
              deleting ? "bg-rose-300" : "bg-rose-600 hover:bg-rose-700"
            } text-white`}
          >
            {deleting ? "Eliminando…" : "Eliminar"}
          </button>
        </div>
      </form>
    </div>
  );
}
