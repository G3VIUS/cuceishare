// src/pages/VistaApunte.jsx
import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

const API =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3001';

// Helpers MIME/ext
const isImage = (mime = '', url = '') =>
  (mime?.startsWith?.('image/') ?? false) || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(url);

const isPDF = (mime = '', url = '') =>
  mime === 'application/pdf' || /\.pdf$/i.test(url);

const isAudio = (mime = '', url = '') =>
  (mime?.startsWith?.('audio/') ?? false) || /\.(mp3|wav|ogg|m4a|aac)$/i.test(url);

const isVideo = (mime = '', url = '') =>
  (mime?.startsWith?.('video/') ?? false) || /\.(mp4|webm|ogg|mov|m4v)$/i.test(url);

function prettySize(bytes) {
  const n = Number(bytes || 0);
  if (!n) return 'N/D';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function VistaApunte() {
  const { id } = useParams();

  const [item, setItem] = useState(null);
  const [fileUrl, setFileUrl] = useState('');
  const [fileMime, setFileMime] = useState('');
  const [err, setErr] = useState('');

  // 1) Carga metadatos del apunte
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`${API}/apuntes/${id}`);
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
        if (alive) setItem(j);
      } catch (e) {
        if (alive) setErr(e.message);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  // 2) Pide al backend la URL renderizable (pública o firmada)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`${API}/apuntes/${id}/url`);
        const j = await r.json();
        if (!r.ok || !j?.url) throw new Error(j?.error || 'No hay URL del archivo');
        if (!alive) return;
        setFileUrl(j.url);
        setFileMime(j.mime || item?.file_mime || '');
      } catch (e) {
        // No detiene la vista: seguimos mostrando los metadatos y botones Abrir/Descargar
        if (!alive) return;
        setFileUrl('');
        setFileMime(item?.file_mime || '');
        // Solo mostrar error si no hay nada que abrir
        if (!item?.resource_url) setErr((prev) => prev || e.message);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const kind = useMemo(() => {
    const mime = fileMime || item?.file_mime || '';
    const url = fileUrl || '';
    return {
      image: isImage(mime, url),
      pdf: isPDF(mime, url),
      audio: isAudio(mime, url),
      video: isVideo(mime, url),
    };
  }, [fileMime, fileUrl, item]);

  if (err && !item) return <div className="p-6 text-rose-700">⚠️ {err}</div>;
  if (!item) return <div className="p-6">Cargando…</div>;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-extrabold truncate">{item.titulo || `Apunte #${item.id}`}</h1>
          <div className="text-xs text-slate-500 mt-1">
            Autor: {item.autor || 'N/D'}
            {item.creado_en ? ` • ${new Date(item.creado_en).toLocaleString()}` : ''}
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/buscar" className="px-3 py-2 rounded-xl border bg-white hover:bg-slate-50">← Buscar</Link>
          <Link to="/perfil" className="px-3 py-2 rounded-xl border bg-white hover:bg-slate-50">Mis apuntes</Link>
        </div>
      </div>

      {/* Descripción */}
      {item.descripcion && <p className="text-slate-700">{item.descripcion}</p>}

      {/* Metadatos */}
      <div className="text-sm text-slate-600 flex flex-wrap gap-3">
        {item.subject_slug && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-indigo-50 text-indigo-700">
            📚 {item.subject_slug}
          </span>
        )}
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 text-slate-700">
          🏷️ {Array.isArray(item.tags) ? item.tags.join(', ') : (item.tags ?? 'sin tags')}
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 text-slate-700">
          🧾 {item.file_mime || 'tipo desconocido'}
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 text-slate-700">
          📦 {prettySize(item.file_size)}
        </span>
        {item.file_name && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 text-slate-700">
            📁 {item.file_name}
          </span>
        )}
      </div>

      {/* Visor */}
      {!fileUrl ? (
        <div className="p-4 border rounded-2xl bg-amber-50 text-amber-800">
          No hay vista previa disponible. Usa “Abrir recurso”.
        </div>
      ) : kind.image ? (
        <div className="border rounded-2xl overflow-hidden">
          <img
            src={fileUrl}
            alt="Vista del apunte"
            className="w-full"
            onError={() => setErr('No se pudo renderizar la imagen')}
          />
        </div>
      ) : kind.pdf ? (
        <div className="border rounded-2xl overflow-hidden h-[75vh]">
          <iframe
            title="PDF"
            src={fileUrl}
            className="w-full h-full"
          />
        </div>
      ) : kind.audio ? (
        <div className="p-4 border rounded-2xl bg-white">
          <audio controls src={fileUrl} className="w-full">
            Tu navegador no soporta audio embebido.
          </audio>
        </div>
      ) : kind.video ? (
        <div className="p-4 border rounded-2xl bg-black">
          <video controls src={fileUrl} className="w-full max-h-[75vh]" />
        </div>
      ) : (
        <div className="p-4 border rounded-2xl bg-slate-50 space-y-2">
          <div className="text-sm text-slate-600">
            No se puede previsualizar este tipo de archivo aquí.
          </div>
          <div className="flex gap-2">
            <a
              href={`${API}/apuntes/${id}/file`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
            >
              🔗 Abrir en nueva pestaña
            </a>
            <a
              href={`${API}/apuntes/${id}/file?download=1`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border hover:bg-slate-50"
            >
              ⬇️ Descargar
            </a>
          </div>
        </div>
      )}

      {/* Acciones rápidas */}
      <div className="flex flex-wrap gap-2">
        <a
          href={`${API}/apuntes/${id}/file`}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border hover:bg-slate-50"
        >
          🔗 Abrir recurso
        </a>
        <a
          href={`${API}/apuntes/${id}/file?download=1`}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border hover:bg-slate-50"
        >
          ⬇️ Descargar
        </a>
      </div>
    </div>
  );
}
