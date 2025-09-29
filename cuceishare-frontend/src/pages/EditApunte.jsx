// src/pages/EditApunte.jsx
import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";

const API =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  process.env.REACT_APP_API_URL ||
  "http://localhost:3001";

const materiasOpc = [
  "Estructuras de Datos",
  "Administración de Servidores",
  "Bases de Datos",
  "Sistemas Operativos",
  "Redes",
  "Programación Avanzada",
];

// === Config de subida ===
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

  // sesión / headers
  const token = localStorage.getItem("token");
  const headers = useMemo(() => {
    const h = { "Content-Type": "application/json" };
    if (token) h["Authorization"] = `Bearer ${token}`;
    return h;
  }, [token]);

  // estado
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const [form, setForm] = useState({
    titulo: "",
    descripcion: "",
    materia: "",
    semestre: "",
    etiquetas: "",
    recurso_url: "",     // URL externa o la que devuelva la subida
    publico: true,
  });

  // archivo seleccionado (opcional)
  const [file, setFile] = useState(null);
  const fileInputRef = useRef(null);

  // cargar apunte
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const r = await fetch(`${API}/apuntes/${id}`, { headers });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);

        if (!alive) return;
        setForm({
          titulo: j.titulo ?? j.title ?? "",
          descripcion: j.descripcion ?? j.description ?? "",
          materia: j.materia ?? j.subject ?? "",
          semestre: String(j.semestre ?? j.semester ?? ""),
          etiquetas: Array.isArray(j.etiquetas ?? j.tags)
            ? (j.etiquetas ?? j.tags).join(", ")
            : (j.etiquetas ?? j.tags ?? ""),
          recurso_url: j.recurso_url ?? j.url ?? j.file_url ?? "",
          publico: typeof j.publico === "boolean" ? j.publico : (j.is_public ?? true),
        });
      } catch (e) {
        setError(e.message || "No se pudo cargar el apunte");
      } finally {
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [API, headers, id]);

  function onChange(e) {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
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
  function onDragOver(e) { e.preventDefault(); }

  function validateAndSetFile(f) {
    if (!ACCEPTED.includes(f.type)) {
      setError("Tipo de archivo no permitido.");
      return;
    }
    if (f.size > MAX_BYTES) {
      setError("El archivo supera 25 MB.");
      return;
    }
    setError("");
    setFile(f);
  }

  async function uploadIfNeeded() {
    if (!file) return null; // nada que subir
    const fd = new FormData();
    fd.append("file", file);
    setUploading(true);
    try {
      // Ajusta el endpoint si tu backend usa otro:
      const r = await fetch(`${API}/apuntes/${id}/archivo`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      // Esperamos { url: "https://..." }
      return j?.url || j?.file_url || j?.location || null;
    } finally {
      setUploading(false);
    }
  }

  async function onSave(e) {
    e?.preventDefault?.();
    setError(""); setSaved("");

    if (!form.titulo.trim()) { setError("El título es requerido"); return; }

    try {
      setSaving(true);

      // 1) subir archivo si hay
      const uploadedUrl = await uploadIfNeeded();
      const finalUrl = uploadedUrl || form.recurso_url || null;

      // 2) guardar metadata
      const payload = {
        titulo: form.titulo,
        descripcion: form.descripcion,
        materia: form.materia || null,
        semestre: form.semestre ? Number(form.semestre) : null,
        etiquetas: form.etiquetas
          ? form.etiquetas.split(",").map(s => s.trim()).filter(Boolean)
          : [],
        recurso_url: finalUrl,
        publico: !!form.publico,
      };

      const r = await fetch(`${API}/apuntes/${id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);

      setSaved("Cambios guardados ✅");
      setFile(null); // limpiar file seleccionado
      setTimeout(() => setSaved(""), 1800);
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
      const r = await fetch(`${API}/apuntes/${id}`, { method: "DELETE", headers });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      navigate("/perfil", { replace: true });
    } catch (e) {
      setError(e.message || "No se pudo eliminar");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <div className="p-6">Cargando…</div>;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-5">
      <h1 className="text-2xl md:text-3xl font-extrabold flex items-center gap-2">
        <span>✏️</span> Editar Apunte
      </h1>

      {(error || saved) && (
        <div className={`p-3 rounded-xl border ${error ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-800"}`}>
          {error || saved}
        </div>
      )}

      <form onSubmit={onSave} className="grid gap-4 bg-white p-5 rounded-2xl border shadow-sm">
        {/* Campos principales */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Título *</label>
          <input
            name="titulo"
            value={form.titulo}
            onChange={onChange}
            className="w-full px-3 py-2 rounded-lg border"
            placeholder="Ej. Servicios de red"
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
              name="materia"
              value={form.materia}
              onChange={onChange}
              className="w-full px-3 py-2 rounded-lg border bg-white"
            >
              <option value="">— Selecciona —</option>
              {materiasOpc.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Semestre</label>
            <select
              name="semestre"
              value={form.semestre}
              onChange={onChange}
              className="w-full px-3 py-2 rounded-lg border bg-white"
            >
              <option value="">—</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Etiquetas (separadas por coma)</label>
          <input
            name="etiquetas"
            value={form.etiquetas}
            onChange={onChange}
            className="w-full px-3 py-2 rounded-lg border"
            placeholder="redes, dns, dhcp"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">URL del recurso (PDF/Drive/GitHub)</label>
          <input
            name="recurso_url"
            value={form.recurso_url}
            onChange={onChange}
            className="w-full px-3 py-2 rounded-lg border"
            placeholder="https://…/mi_apunte.pdf"
            disabled={!!file} // si elige archivo, bloquea el campo (opcional)
          />
          {form.recurso_url && !file && (
            <a
              className="text-sm text-indigo-700 underline"
              href={form.recurso_url}
              target="_blank" rel="noreferrer"
            >
              Abrir recurso
            </a>
          )}
        </div>

        {/* === Área de archivo (drag & drop) + Consejos === */}
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
                <div className="text-slate-500">{(file.size / (1024*1024)).toFixed(2)} MB</div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="mt-2 px-2 py-1 rounded-lg border bg-white hover:bg-slate-50 text-xs"
                >
                  Quitar
                </button>
              </div>
            )}

            {uploading && (
              <div className="mt-3 text-sm text-slate-600">Subiendo archivo…</div>
            )}
          </div>

          <aside className="p-4 rounded-2xl border bg-slate-50 text-sm">
            <div className="font-semibold mb-2">Consejos</div>
            <ul className="list-disc pl-4 space-y-1 text-slate-700">
              <li>Prefiere PDF para mayor compatibilidad.</li>
              <li>Describe el contenido y agrega etiquetas.</li>
              <li>Si es tuyo, incluye portada o nombre.</li>
              <li>También puedes compartir solo el enlace.</li>
            </ul>
          </aside>
        </div>

        <label className="inline-flex items-center gap-2 select-none">
          <input
            type="checkbox"
            name="publico"
            checked={form.publico}
            onChange={onChange}
            className="h-4 w-4"
          />
          <span className="text-sm">Público (visible para todos)</span>
        </label>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            disabled={saving || uploading}
            className={`px-4 py-2 rounded-xl text-white font-semibold ${saving || uploading ? "bg-green-400" : "bg-green-600 hover:bg-green-700"}`}
          >
            {saving ? "Guardando…" : uploading ? "Subiendo…" : "Guardar cambios"}
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
            className={`px-4 py-2 rounded-xl ${deleting ? "bg-rose-300" : "bg-rose-600 hover:bg-rose-700"} text-white`}
          >
            {deleting ? "Eliminando…" : "Eliminar"}
          </button>
        </div>
      </form>
    </div>
  );
}
