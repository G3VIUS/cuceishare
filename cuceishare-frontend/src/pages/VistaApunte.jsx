// src/pages/VistaApunte.jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

const API =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3001';

/* ---------- Helpers MIME/ext ---------- */
const hasExt = (url = '', exts = []) => {
  try {
    const clean = String(url).split('?')[0].split('#')[0];
    return exts.some(ext => new RegExp(`\\.${ext}$`, 'i').test(clean));
  } catch { return false; }
};

const isImage = (mime = '', url = '') =>
  (mime?.startsWith?.('image/') ?? false) || hasExt(url, ['png','jpg','jpeg','gif','webp','bmp','svg']);

const isPDF = (mime = '', url = '') =>
  mime === 'application/pdf' || hasExt(url, ['pdf']);

const isAudio = (mime = '', url = '') =>
  (mime?.startsWith?.('audio/') ?? false) || hasExt(url, ['mp3','wav','ogg','m4a','aac','flac']);

const isVideo = (mime = '', url = '') =>
  (mime?.startsWith?.('video/') ?? false) || hasExt(url, ['mp4','webm','ogg','mov','m4v','mkv']);

const isTextLike = (mime = '', url = '') =>
  (mime?.startsWith?.('text/') ?? false) || hasExt(url, ['txt','md','csv','json','log']);

const isOffice = (mime = '', url = '') => {
  const officeMimes = new Set([
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ]);
  return officeMimes.has(mime) || hasExt(url, ['doc','docx','xls','xlsx','ppt','pptx']);
};

function prettySize(bytes) {
  const n = Number(bytes || 0);
  if (!n) return 'N/D';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const safeJSON = (s) => { try { return JSON.parse(s || 'null'); } catch { return null; } };

const Skeleton = ({ className = '' }) =>
  <div className={`animate-pulse bg-slate-200 rounded ${className}`} />;

/* ---------- Componente ---------- */
export default function VistaApunte() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Session (por si el backend requiere auth)
  const user  = useMemo(() => safeJSON(localStorage.getItem('usuario')), []);
  const token = useMemo(() => localStorage.getItem('token') || '', []);
  const HEADERS = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  // Estado
  const [item, setItem] = useState(null);          // metadatos del apunte
  const [fileUrl, setFileUrl] = useState('');      // url renderizable (firmada/pública)
  const [fileMime, setFileMime] = useState('');    // mime para decidir visor
  const [err, setErr] = useState('');              // errores visibles
  const [loading, setLoading] = useState(true);    // loading de la vista completa
  const [urlLoading, setUrlLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Para render de texto puro si CORS lo permite
  const [textPreview, setTextPreview] = useState('');
  const textTriedRef = useRef(false);

  // 1) Carga metadatos del apunte
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setErr('');
      try {
        const { data } = await axios.get(`${API}/apuntes/${id}`, { headers: HEADERS, params: { _t: Date.now() } });
        if (!alive) return;
        setItem(data);
      } catch (e) {
        if (!alive) return;
        const msg = e?.response?.data?.error || e?.message || 'No se pudo cargar el apunte';
        setErr(msg);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id, HEADERS]);

  // 2) Obtener URL renderizable (firmada/pública). Fallback a item.resource_url
  useEffect(() => {
    let alive = true;
    if (!item) return;

    (async () => {
      setUrlLoading(true); setTextPreview(''); textTriedRef.current = false;
      try {
        const { data } = await axios.get(`${API}/apuntes/${id}/url`, { headers: HEADERS, params: { _t: Date.now() } });
        if (!alive) return;
        if (data?.url) {
          setFileUrl(data.url);
          setFileMime(data.mime || item.file_mime || '');
        } else if (item?.resource_url) {
          setFileUrl(item.resource_url);
          setFileMime(item.file_mime || '');
        } else {
          // Último recurso: vista directa por endpoint file
          setFileUrl(`${API}/apuntes/${id}/file`);
          setFileMime(item.file_mime || '');
        }
      } catch {
        if (!alive) return;
        // Fallbacks
        if (item?.resource_url) {
          setFileUrl(item.resource_url);
          setFileMime(item.file_mime || '');
        } else {
          setFileUrl(`${API}/apuntes/${id}/file`);
          setFileMime(item.file_mime || '');
        }
      } finally {
        if (alive) setUrlLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [id, item, HEADERS]);

  // 3) Derivados de tipo
  const kind = useMemo(() => {
    const mime = fileMime || item?.file_mime || '';
    const url  = fileUrl || item?.resource_url || '';
    return {
      image: isImage(mime, url),
      pdf: isPDF(mime, url),
      audio: isAudio(mime, url),
      video: isVideo(mime, url),
      text: isTextLike(mime, url),
      office: isOffice(mime, url),
    };
  }, [fileMime, fileUrl, item]);

  // 4) Si es texto, intentamos traerlo como texto plano (si CORS lo permite).
  useEffect(() => {
    let alive = true;
    if (!kind.text || !fileUrl || textTriedRef.current) return;
    textTriedRef.current = true;

    (async () => {
      try {
        const r = await fetch(fileUrl);
        if (!alive) return;
        // Si no hace CORS o falla, que caiga al iframe genérico
        if (!r.ok || !r.headers.get('content-type')?.includes('text')) return;
        const t = await r.text();
        if (!alive) return;
        setTextPreview(t.slice(0, 500000)); // safety limit
      } catch {
        // Ignoramos; el iframe genérico cubrirá
      }
    })();

    return () => { alive = false; };
  }, [kind.text, fileUrl]);

  // 5) Acciones
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(String(fileUrl || `${API}/apuntes/${id}/file`));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const openUrl  = fileUrl || `${API}/apuntes/${id}/file`;
  const dlUrl    = `${API}/apuntes/${id}/file?download=1`;
  const pdfSrc   = kind.pdf ? `${openUrl}#toolbar=1&navpanes=0` : '';
  const officeViewer = kind.office
    ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(openUrl)}`
    : '';

  /* ---------- Render ---------- */
  if (loading && !item) {
    return (
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-28" />
          </div>
        </div>
        <Skeleton className="h-4 w-80" />
        <div className="flex gap-2 flex-wrap">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-6 w-36" />
        </div>
        <Skeleton className="h-[60vh] w-full" />
      </div>
    );
  }

  if (err && !item) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="p-4 rounded-xl bg-rose-50 border text-rose-800">
          ⚠️ {err}
          <button
            onClick={() => navigate(0)}
            className="ml-3 px-3 py-1.5 rounded-lg bg-white border hover:bg-slate-50"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!item) return null;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-extrabold truncate">
            {item.titulo || `Apunte #${item.id}`}
          </h1>
          <div className="text-xs text-slate-500 mt-1">
            Autor: {item.autor || 'N/D'}
            {item.creado_en ? ` • ${new Date(item.creado_en).toLocaleString()}` : ''}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/buscar" className="px-3 py-2 rounded-xl border bg-white hover:bg-slate-50">← Buscar</Link>
          <Link to="/perfil" className="px-3 py-2 rounded-xl border bg-white hover:bg-slate-50">Mis apuntes</Link>
        </div>
      </div>

      {/* Descripción */}
      {item.descripcion && <p className="text-slate-700">{item.descripcion}</p>}

      {/* Metadatos */}
      <div className="text-sm text-slate-600 flex flex-wrap gap-2">
        {item.subject_slug && (
          <Link
            to={`/buscar?materia=${encodeURIComponent(item.subject_slug)}`}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
            title="Ver más de esta materia"
          >
            📚 {item.subject_slug}
          </Link>
        )}
        {item.block_id && (
          <Link
            to={`/buscar?materia=${encodeURIComponent(item.subject_slug || '')}&blockId=${encodeURIComponent(item.block_id)}`}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            title="Ver más del mismo bloque"
          >
            🧩 Bloque
          </Link>
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
      {urlLoading ? (
        <div className="p-4 border rounded-2xl bg-white">
          <Skeleton className="h-6 w-48 mb-3" />
          <Skeleton className="h-[60vh] w-full" />
        </div>
      ) : !fileUrl ? (
        <div className="p-4 border rounded-2xl bg-amber-50 text-amber-800">
          No hay vista previa disponible. Usa “Abrir recurso”.
        </div>
      ) : (
        <>
          {kind.image && (
            <div className="border rounded-2xl overflow-hidden">
              <img
                src={fileUrl}
                alt="Vista del apunte"
                className="w-full"
                onError={() => setErr('No se pudo renderizar la imagen')}
              />
            </div>
          )}

          {kind.pdf && (
            <div className="border rounded-2xl overflow-hidden h-[75vh] bg-white">
              <iframe title="PDF" src={pdfSrc} className="w-full h-full" />
            </div>
          )}

          {kind.audio && (
            <div className="p-4 border rounded-2xl bg-white">
              <audio controls src={fileUrl} className="w-full">
                Tu navegador no soporta audio embebido.
              </audio>
            </div>
          )}

          {kind.video && (
            <div className="p-4 border rounded-2xl bg-black">
              <video controls src={fileUrl} className="w-full max-h-[75vh]" />
            </div>
          )}

          {kind.office && (
            <div className="border rounded-2xl overflow-hidden h-[75vh] bg-white">
              <iframe title="Office Viewer" src={officeViewer} className="w-full h-full" />
            </div>
          )}

          {kind.text && textPreview && (
            <div className="border rounded-2xl overflow-hidden bg-white">
              <div className="grid grid-cols-[auto_1fr]">
                <pre className="select-none bg-slate-50 text-slate-500 p-3 text-xs leading-5 overflow-auto">
                  {textPreview.split('\n').map((_, i) => String(i + 1).padStart(4, ' ') + '\n')}
                </pre>
                <pre className="p-3 text-sm leading-5 overflow-auto">{textPreview}</pre>
              </div>
            </div>
          )}

          {/* Fallback genérico si no se pudo previsualizar nada de lo anterior */}
          {!kind.image && !kind.pdf && !kind.audio && !kind.video && !kind.office && (!kind.text || !textPreview) && (
            <div className="p-4 border rounded-2xl bg-slate-50 space-y-2">
              <div className="text-sm text-slate-600">
                No se puede previsualizar este tipo de archivo aquí.
              </div>
              <div className="flex gap-2">
                <a
                  href={openUrl}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  🔗 Abrir en nueva pestaña
                </a>
                <a
                  href={dlUrl}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border hover:bg-slate-50"
                >
                  ⬇️ Descargar
                </a>
              </div>
            </div>
          )}
        </>
      )}

      {/* Errores no bloqueantes */}
      {err && (
        <div className="p-3 rounded-xl border bg-rose-50 text-rose-800">
          ⚠️ {err}{' '}
          <button onClick={() => navigate(0)} className="ml-2 underline">
            Reintentar
          </button>
        </div>
      )}

      {/* Acciones rápidas */}
      <div className="flex flex-wrap gap-2">
        <a
          href={openUrl}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border hover:bg-slate-50"
        >
          🔗 Abrir recurso
        </a>
        <a
          href={dlUrl}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border hover:bg-slate-50"
        >
          ⬇️ Descargar
        </a>
        <button
          onClick={onCopy}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border hover:bg-slate-50"
          title="Copiar enlace del recurso"
        >
          {copied ? '✅ Copiado' : '📋 Copiar enlace'}
        </button>
        {item?.titulo && (
          <Link
            to={`/buscar?q=${encodeURIComponent(item.titulo)}${item.subject_slug ? `&materia=${encodeURIComponent(item.subject_slug)}` : ''}`}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border hover:bg-slate-50"
          >
            🔎 Buscar similares
          </Link>
        )}
      </div>
    </div>
  );
}
