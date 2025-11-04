// src/pages/SubirApunte.jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

/* ======================
   Config & helpers
====================== */
const API =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3001';

/**
 * slug: visible en UI
 * value: slug REAL para backend (subject_slug y /api/:subject/route/blocks)
 */
const SUBJECTS = [
  { slug: 'ed1',                     nombre: 'Estructuras de Datos I', value: 'ed1' },
  { slug: 'administracion-servidores', nombre: 'Administración de Servidores', value: 'aserv' },
  { slug: 'mineria-datos',           nombre: 'Minería de Datos', value: 'mineria' },
  { slug: 'redes',                   nombre: 'Redes', value: 'redes' },
  { slug: 'algoritmia',              nombre: 'Algoritmia', value: 'algoritmia' },
  { slug: 'programacion',            nombre: 'Programación', value: 'programacion' },
  { slug: 'ingenieria-software',     nombre: 'Ingeniería de Software', value: 'isw' },
  { slug: 'seguridad-informacion',   nombre: 'Seguridad de la Información', value: 'seguridad' },
  { slug: 'teoria-computacion',      nombre: 'Teoría de la Computación', value: 'teoria' },
];

const LS_SUBJECT = 'lastSubjectSlug';
const MAX_MB = 25;
const ACCEPT = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'image/png',
  'image/jpeg',
  'text/plain',
];

const cx = (...xs) => xs.filter(Boolean).join(' ');
const prettyBytes = (b) => {
  if (!Number.isFinite(b)) return '—';
  const u = ['B', 'KB', 'MB', 'GB']; let i = 0, n = b;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
};

/* ======================
   Component
====================== */
export default function SubirApunte() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  // sesión local
  const sesion = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('usuario')); } catch { return null; }
  }, []);
  const autor = sesion?.username || sesion?.tipo || `user-${sesion?.id ?? ''}`;

  useEffect(() => {
    if (!token) navigate('/login?next=/subir', { replace: true });
  }, [token, navigate]);

  // materia
  const storedSubject = localStorage.getItem(LS_SUBJECT) || 'ed1';
  const [subjectSlug, setSubjectSlug] = useState(
    SUBJECTS.some(s => s.slug === storedSubject) ? storedSubject : 'ed1'
  );
  const subjectValue = useMemo(
    () => SUBJECTS.find(s => s.slug === subjectSlug)?.value || 'ed1',
    [subjectSlug]
  );
  useEffect(() => { localStorage.setItem(LS_SUBJECT, subjectSlug); }, [subjectSlug]);

  // form
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const tags = useMemo(() => tagsInput.split(',').map(t => t.trim()).filter(Boolean), [tagsInput]);
  const [visibilidad, setVisibilidad] = useState('public');

  // bloques (por nombre)
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [blocksErr, setBlocksErr] = useState('');
  const [blocks, setBlocks] = useState([]); // [{id,title,code,orden}]
  const [blockId, setBlockId] = useState('');

  // archivo
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  // UI
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState(0);

  // cargar bloques cuando cambia la materia
  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();

    (async () => {
      setBlocksLoading(true);
      setBlocksErr('');
      setBlocks([]);
      setBlockId('');
      try {
        const url = `${API}/api/${subjectValue}/route/blocks`;
        const r = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: ctrl.signal,
        });

        if (!r.ok) {
          if (r.status !== 404) {
            const j = await r.json().catch(() => ({}));
            throw new Error(j?.error || `HTTP ${r.status}`);
          } else {
            if (alive) setBlocks([]);
            return;
          }
        }

        const raw = await r.json().catch(() => ({}));
        const list = Array.isArray(raw?.items) ? raw.items
                  : Array.isArray(raw?.rows)  ? raw.rows
                  : Array.isArray(raw)        ? raw
                  : [];

        const norm = list.map((b, i) => ({
          id: b.id || b.uuid || b.block_id || String(i + 1),
          title: b.title || b.titulo || b.nombre || b.name || b.block_title || `Bloque ${i + 1}`,
          code: b.code ?? null,
          orden: typeof b.orden === 'number' ? b.orden : null,
        }));

        if (alive) setBlocks(norm);
      } catch (e) {
        if (alive) setBlocksErr(e.message || 'No se pudieron cargar los bloques');
      } finally {
        if (alive) setBlocksLoading(false);
      }
    })();

    return () => { alive = false; ctrl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectValue, token]);

  function onPickFile(f) {
    if (!f) return;
    if (f.size > MAX_MB * 1024 * 1024) { setError(`El archivo supera ${MAX_MB} MB.`); return; }
    if (ACCEPT.length && f.type && !ACCEPT.includes(f.type)) { setError('Tipo de archivo no permitido.'); return; }
    setError(''); setFile(f);
  }
  const onDrop = (e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); onPickFile(e.dataTransfer?.files?.[0]); };
  const onDragOver = (e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); };
  const onDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); };

  async function handleSubmit(e) {
    e.preventDefault();
    setMensaje(''); setError(''); setProgreso(0);

    if (!titulo.trim()) { setError('❗ El título es obligatorio.'); return; }
    if (!descripcion.trim()) { setError('❗ La descripción es obligatoria.'); return; }
    if (!file) { setError('❗ Sube un archivo.'); return; }
    if (!token) { setError('❗ Sesión no válida. Inicia sesión.'); return; }

    try {
      setSubiendo(true);

      const fd = new FormData();
      fd.append('titulo', titulo);
      fd.append('descripcion', descripcion);
      fd.append('autor', autor);
      fd.append('subject_slug', subjectValue);   // slug real
      fd.append('visibilidad', visibilidad);
      fd.append('tags', JSON.stringify(tags));
      if (blockId) fd.append('block_id', blockId); // del combo
      fd.append('file', file);

      const { data } = await axios.post(`${API}/apuntes`, fd, {
        headers: { Authorization: `Bearer ${token}` },
        onUploadProgress: (evt) => {
          if (!evt.total) return;
          setProgreso(Math.round((evt.loaded / evt.total) * 100));
        }
      });

      setMensaje(`✅ Apunte creado con ID ${data?.id ?? '—'}`);
      setTitulo(''); setDescripcion(''); setTagsInput('');
      setFile(null); setProgreso(0); setBlockId('');
      if (data?.id) setTimeout(() => navigate(`/apunte/${data.id}`), 800);
    } catch (err) {
      setError(`❌ Error: ${err?.response?.data?.error || err.message || 'No se pudo subir el apunte'}`);
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">📤 Subir apunte</h2>
          <p className="text-slate-500 text-sm">Comparte PDFs, presentaciones o imágenes.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/perfil" className="px-3 py-2 rounded-xl border bg-white hover:bg-slate-50">Mis apuntes</Link>
        </div>
      </div>

      {/* Mensajes */}
      {mensaje && <div className="rounded-xl border bg-emerald-50 text-emerald-800 px-3 py-2">✅ {mensaje}</div>}
      {error && <div className="rounded-xl border bg-rose-50 text-rose-800 px-3 py-2">⚠️ {error}</div>}

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border shadow-sm p-5 space-y-5">
        {/* Materia + visibilidad */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block mb-1 text-sm font-medium text-slate-700">Materia</label>
            <select
              value={subjectSlug}
              onChange={(e) => setSubjectSlug(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 bg-white"
            >
              {SUBJECTS.map(s => (<option key={s.slug} value={s.slug}>{s.nombre}</option>))}
            </select>
            <p className="text-xs text-slate-500 mt-1">Se usa <code>{subjectValue}</code> como <em>subject_slug</em>.</p>
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium text-slate-700">Visibilidad</label>
            <select
              value={visibilidad}
              onChange={(e) => setVisibilidad(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 bg-white"
            >
              <option value="public">Público</option>
              <option value="private">Privado</option>
            </select>
          </div>
        </div>

        {/* Bloque por nombre */}
        <div>
          <label className="block mb-1 text-sm font-medium text-slate-700">Bloque (opcional)</label>
          <div className="flex items-center gap-2">
            <select
              value={blockId}
              onChange={(e) => setBlockId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 bg-white"
              disabled={blocksLoading || !!blocksErr}
            >
              <option value="">— Sin bloque —</option>
              {blocks.map(b => (
                <option key={b.id} value={b.id}>
                  {b.orden != null ? `${b.orden}. ` : ''}{b.title}{b.code ? ` — ${b.code}` : ''}
                </option>
              ))}
            </select>
            {blocksLoading && <span className="text-xs text-slate-500">Cargando…</span>}
          </div>
          {blocksErr && <div className="text-xs text-rose-700 mt-1">Bloques: {blocksErr}</div>}
          {!blocksLoading && !blocksErr && !blocks.length && (
            <p className="text-xs text-slate-500 mt-1">No hay bloques publicados para esta materia.</p>
          )}
        </div>

        {/* Título */}
        <div>
          <label className="block mb-1 text-sm font-medium text-slate-700">Título *</label>
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
            placeholder="Ej. ED1 — TDA Árbol (ABB, AVL)"
          />
        </div>

        {/* Descripción */}
        <div>
          <label className="block mb-1 text-sm font-medium text-slate-700">Descripción *</label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
            rows={4}
            placeholder="Resumen con conceptos clave, ejemplos y ejercicios…"
          />
          <p className="text-xs text-slate-500 mt-1">Sé descriptivo: ayuda a otros a encontrar tu recurso.</p>
        </div>

        {/* Tags */}
        <div>
          <label className="block mb-1 text-sm font-medium text-slate-700">Etiquetas</label>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
            placeholder="separa, con, comas (ej. listas, pilas, colas)"
          />
          {!!tags.length && (
            <div className="flex flex-wrap gap-2 mt-2">
              {tags.map((t, i) => (
                <span key={`${t}-${i}`} className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs border">#{t}</span>
              ))}
            </div>
          )}
        </div>

        {/* Subida de archivo */}
        <div className="grid md:grid-cols-[1fr_220px] gap-4 items-stretch">
          <div
            onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
            className={cx(
              'rounded-2xl border-2 border-dashed p-6 text-center transition',
              dragOver ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300'
            )}
          >
            <div className="text-4xl mb-2">📎</div>
            <p className="font-medium">Arrastra tu archivo aquí</p>
            <p className="text-sm text-slate-500">o</p>
            <div className="mt-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="px-4 py-2 rounded-xl border bg-white hover:bg-slate-50"
              >
                Elegir archivo
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.txt"
                className="hidden"
                onChange={(e) => onPickFile(e.target.files?.[0])}
              />
            </div>

            {file ? (
              <div className="mt-4 text-left max-w-md mx-auto">
                <div className="flex items-center justify-between text-sm">
                  <div className="truncate">{file.name}</div>
                  <div className="text-slate-500">{prettyBytes(file.size)}</div>
                </div>
                <div className="h-2 bg-slate-200 rounded mt-2 overflow-hidden">
                  <div className="h-2 bg-indigo-600 transition-[width] duration-300" style={{ width: `${progreso}%` }} />
                </div>
                {subiendo && <div className="text-xs text-slate-600 mt-1">Subiendo… {progreso}%</div>}
                {!subiendo && (
                  <button
                    type="button"
                    className="mt-2 text-rose-600 text-sm hover:underline"
                    onClick={() => { setFile(null); setProgreso(0); }}
                  >
                    Quitar archivo
                  </button>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500 mt-3">
                Formatos aceptados: PDF, DOC/DOCX, PPT/PPTX, PNG, JPG, TXT. Límite {MAX_MB} MB.
              </p>
            )}
          </div>

          <div className="rounded-2xl border p-4 bg-slate-50">
            <div className="text-sm text-slate-700 font-semibold mb-2">Consejos</div>
            <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
              <li>Prefiere PDF para mayor compatibilidad.</li>
              <li>Describe el contenido y agrega etiquetas.</li>
              <li>Si es tuyo, incluye portada o nombre.</li>
            </ul>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={subiendo}
            className={cx(
              'px-5 py-2 rounded-xl text-white font-semibold shadow-sm',
              subiendo ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'
            )}
          >
            {subiendo ? 'Subiendo…' : 'Subir apunte'}
          </button>
          <Link to="/perfil" className="px-4 py-2 rounded-xl border bg-white hover:bg-slate-50">Cancelar</Link>
        </div>
      </form>

      <div className="text-xs text-slate-500">
        Nota: se envía a <code>{API}/apuntes</code> como <code>multipart/form-data</code> con tu token.
      </div>
    </div>
  );
}
