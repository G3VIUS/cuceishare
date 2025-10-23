import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';

/* ===== Config API ===== */
const API =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3001';

/* ===== UI helpers ===== */
const cx = (...xs) => xs.filter(Boolean).join(' ');
const Btn = ({ className = '', ...p }) => (
  <button
    {...p}
    className={cx(
      'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium transition shadow-sm',
      'bg-white hover:bg-slate-50 border',
      className
    )}
  />
);
const BtnPrimary = ({ className = '', ...p }) => (
  <button
    {...p}
    className={cx(
      'inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-2 text-sm font-semibold transition shadow',
      'bg-indigo-600 hover:bg-indigo-700 text-white',
      className
    )}
  />
);
const PillLink = ({ to, active, children }) => (
  <Link
    to={to}
    className={cx(
      'rounded-2xl px-4 py-2 text-sm font-semibold shadow-sm border',
      active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white hover:bg-slate-50'
    )}
  >
    {children}
  </Link>
);

/* ===== util: hostname/provider ===== */
const hostFromUrl = (u) => { try { return new URL(u).hostname.replace(/^www\./,''); } catch { return ''; } };
const guessProvider = (u) => {
  const h = hostFromUrl(u);
  if (!h) return '';
  if (h.includes('youtube.') || h.includes('youtu.be')) return 'YouTube';
  if (h.includes('wikipedia.org')) return 'Wikipedia';
  if (h.includes('github.com')) return 'GitHub';
  if (h.includes('geeksforgeeks')) return 'GeeksforGeeks';
  if (h.includes('programiz')) return 'Programiz';
  if (h.includes('medium.com')) return 'Medium';
  return h;
};
const guessTipo = (u) => {
  try {
    const url = new URL(u);
    const h = url.hostname.toLowerCase();
    const p = url.pathname.toLowerCase();
    if (h.includes('youtube.') || h.includes('youtu.be')) return 'video';
    if (/\.(pdf)$/.test(p)) return 'pdf';
    if (/\.(ppt|pptx)$/.test(p)) return 'slides';
    if (/\.(doc|docx|md)$/.test(p)) return 'doc';
    if (/\.(png|jpg|jpeg|gif|webp|svg)$/.test(p)) return 'image';
    if (h.includes('github.com')) return 'repo';
    return 'web';
  } catch { return ''; }
};

/* =========================================================
   AdminContenido (block_resources)
   ========================================================= */
export default function AdminContenido() {
  const navigate = useNavigate();

  // sesión/role
  const token = localStorage.getItem('token') || '';
  let role = '';
  try { role = JSON.parse(localStorage.getItem('usuario'))?.tipo || ''; } catch {}
  const headers = { Authorization: `Bearer ${token}` };
  const notAdmin = !token || String(role).toLowerCase() !== 'admin';

  // ===== catálogo global (siempre TODAS las materias) =====
  const [subjects, setSubjects] = useState([]); // [{id,slug,nombre,blocks:[{id,code,titulo,orden}]}]
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [subjectsErr, setSubjectsErr] = useState('');

  // ===== filtros de lista =====
  const [subject, setSubject] = useState(''); // slug
  const [blockId, setBlockId] = useState(''); // uuid
  const [q, setQ] = useState('');
  const [order, setOrder] = useState('rankDesc'); // rankDesc | rankAsc | title
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // ===== listado =====
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  // ===== “Añadir” (independiente de filtros) =====
  const [addSubject, setAddSubject] = useState(''); // slug
  const [addBlockId, setAddBlockId] = useState(''); // uuid
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [rank, setRank] = useState(0);
  const [tipo, setTipo] = useState('');
  const [provider, setProvider] = useState('');

  // bloques derivados para UI
  const blocksForFilter = useMemo(() => {
    const s = subjects.find(x => x.slug === subject);
    return s?.blocks || [];
  }, [subjects, subject]);

  const blocksForAdd = useMemo(() => {
    const s = subjects.find(x => x.slug === addSubject);
    return s?.blocks || [];
  }, [subjects, addSubject]);

  // ===== cargar catálogo (siempre todo, sin filtrar por materia) =====
  const loadCatalog = useCallback(async () => {
    setSubjectsLoading(true);
    setSubjectsErr('');
    try {
      const r = await fetch(`${API}/admin/contenido/catalogs`, { headers });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      setSubjects(Array.isArray(j.subjects) ? j.subjects : []);
    } catch (e) {
      setSubjectsErr(e.message || 'No se pudo cargar el catálogo');
      setSubjects([]);
    } finally {
      setSubjectsLoading(false);
    }
  }, []);

  useEffect(() => { loadCatalog(); }, [loadCatalog]);

  // Sincroniza “Añadir” con los filtros la primera vez que haya catálogo
  useEffect(() => {
    if (!subjects.length) return;
    // si no hay addSubject y sí hay subject seleccionado en filtro, úsalo
    setAddSubject(prev => prev || subject || '');
    // si hay bloques y blockId coincide con el filtro, úsalo
    if (subject) {
      const blkExists = blocksForAdd.some(b => b.id === blockId);
      setAddBlockId(prev => (prev || (blkExists ? blockId : '')));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjects.length]); // intencional: una vez cargado catálogo

  // Cuando cambia el “subject” del formulario de añadir, limpiamos el bloque
  useEffect(() => {
    setAddBlockId('');
  }, [addSubject]);

  // ===== cargar lista =====
  const loadList = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (subject) params.set('subject', subject);
      if (blockId) params.set('block', blockId);
      if (order) params.set('order', order);
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));

      const r = await fetch(`${API}/admin/contenido?${params.toString()}`, { headers });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);

      setRows(Array.isArray(j.items) ? j.items : []);
      setTotal(j.total || 0);
    } catch (e) {
      setErr(e.message || 'No se pudo cargar el contenido');
      setRows([]); setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [q, subject, blockId, order, page, pageSize]);

  useEffect(() => { loadList(); }, [loadList]);

  // ===== CRUD =====
  const createItem = async () => {
    if (!addSubject) return alert('Selecciona una materia en “Añadir”.');
    if (!addBlockId) return alert('Selecciona un bloque en “Añadir”.');
    if (!title.trim()) return alert('Escribe un título.');
    if (!url.trim()) return alert('Escribe una URL.');
    const body = {
      block_id: addBlockId,
      title: title.trim(),
      url: url.trim(),
      rank: Number(rank) || 0,
      tipo: (tipo || guessTipo(url)).trim() || null,
      provider: (provider || guessProvider(url)).trim() || null,
    };
    const r = await fetch(`${API}/admin/contenido`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return alert(j?.error || `HTTP ${r.status}`);
    // limpiar draft y refrescar
    setTitle(''); setUrl(''); setRank(0); setTipo(''); setProvider('');
    await loadList();
  };

  const updateItem = async (id, patch) => {
    const r = await fetch(`${API}/admin/contenido/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(patch),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return alert(j?.error || `HTTP ${r.status}`);
  };

  const deleteItem = async (id) => {
    if (!window.confirm('¿Eliminar este recurso definitivamente?')) return;
    const r = await fetch(`${API}/admin/contenido/${id}`, {
      method: 'DELETE',
      headers,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return alert(j?.error || `HTTP ${r.status}`);
    await loadList();
  };

  // ===== Paginación =====
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 space-y-5">
      {/* Header y tabs grandes */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            ⚙️ Admin · Contenido
          </h1>
          <p className="text-slate-500 text-sm">Gestiona recursos por materia y bloque.</p>
        </div>
        <div className="flex gap-2">
          <PillLink to="/admin/apuntes" active={false}>📄 Admin Apuntes</PillLink>
          <PillLink to="/admin/contenido" active>📚 Admin Contenido</PillLink>
          <Btn onClick={() => navigate('/')}>Volver</Btn>
        </div>
      </div>

      {/* Aviso de permisos (no rompe hooks) */}
      {notAdmin && (
        <div className="rounded-xl border bg-amber-50 text-amber-800 p-4">
          Debes iniciar sesión como <b>admin</b> para ver este panel.
        </div>
      )}

      {/* Filtros de LISTA */}
      <div className="grid lg:grid-cols-12 gap-3">
        <div className="lg:col-span-3 space-y-2">
          <label className="text-xs text-slate-500">Materia (filtro de lista)</label>
          <select
            value={subject}
            onChange={(e)=>{ setSubject(e.target.value); setBlockId(''); setPage(1); }}
            className="w-full px-3 py-2 rounded-2xl border bg-white"
            disabled={subjectsLoading}
          >
            <option value="">Todas</option>
            {(subjects || []).map(s => (
              <option key={s.slug} value={s.slug}>{s.nombre}</option>
            ))}
          </select>
          {subjectsErr && <div className="text-xs text-rose-700">⚠️ {subjectsErr}</div>}
        </div>

        <div className="lg:col-span-3 space-y-2">
          <label className="text-xs text-slate-500">Bloque (filtro de lista)</label>
          <select
            value={blockId}
            onChange={(e)=>{ setBlockId(e.target.value); setPage(1); }}
            className="w-full px-3 py-2 rounded-2xl border bg-white"
            disabled={!subject || subjectsLoading}
          >
            <option value="">Todos</option>
            {blocksForFilter.map(b => (
              <option key={b.id} value={b.id}>
                {b.titulo || (b.orden != null ? `Bloque ${b.orden}` : (b.code || String(b.id).slice(0,8)))}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-3 space-y-2">
          <label className="text-xs text-slate-500">Orden</label>
          <select
            value={order}
            onChange={(e)=>{ setOrder(e.target.value); setPage(1); }}
            className="w-full px-3 py-2 rounded-2xl border bg-white"
          >
            <option value="rankDesc">Rank (alto → bajo)</option>
            <option value="rankAsc">Rank (bajo → alto)</option>
            <option value="title">Título A→Z</option>
          </select>
        </div>

        <div className="lg:col-span-3 space-y-2">
          <label className="text-xs text-slate-500">Buscar</label>
          <div className="flex gap-2">
            <input
              value={q}
              onChange={(e)=>{ setQ(e.target.value); setPage(1); }}
              placeholder="Título, URL o proveedor…"
              className="flex-1 px-3 py-2 rounded-2xl border bg-white"
            />
            <Btn onClick={loadList}>Buscar</Btn>
          </div>
        </div>
      </div>

      {/* Añadir recurso (con Materia y Bloque propios) */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">➕ Añadir recurso</h3>
          <div className="text-xs text-slate-500">
            Se añadirá a:
            {' '}
            <b>{addSubject || '—'}</b>
            {addBlockId ? ` / ${addBlockId.slice(0,8)}…` : ''}
          </div>
        </div>

        <div className="grid md:grid-cols-6 gap-3 mb-3">
          <div className="md:col-span-2">
            <label className="text-xs text-slate-500">Materia</label>
            <select
              value={addSubject}
              onChange={(e)=>setAddSubject(e.target.value)}
              className="w-full px-3 py-2 rounded-2xl border bg-white"
              disabled={subjectsLoading}
            >
              <option value="">Selecciona…</option>
              {(subjects || []).map(s => (
                <option key={s.slug} value={s.slug}>{s.nombre}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="text-xs text-slate-500">Bloque</label>
            <select
              value={addBlockId}
              onChange={(e)=>setAddBlockId(e.target.value)}
              className="w-full px-3 py-2 rounded-2xl border bg-white"
              disabled={!addSubject || subjectsLoading}
            >
              <option value="">Selecciona…</option>
              {blocksForAdd.map(b => (
                <option key={b.id} value={b.id}>
                  {b.titulo || (b.orden != null ? `Bloque ${b.orden}` : (b.code || String(b.id).slice(0,8)))}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-1">
            <label className="text-xs text-slate-500">Rank</label>
            <input
              type="number"
              className="w-full px-3 py-2 rounded-2xl border bg-white"
              placeholder="0"
              value={rank}
              onChange={(e)=>setRank(e.target.value)}
            />
          </div>

          <div className="md:col-span-1">
            <label className="text-xs text-slate-500">Tipo</label>
            <select
              className="w-full px-3 py-2 rounded-2xl border bg-white"
              value={tipo}
              onChange={(e)=>setTipo(e.target.value)}
            >
              <option value="">(auto)</option>
              <option value="web">web</option>
              <option value="pdf">pdf</option>
              <option value="video">video</option>
              <option value="repo">repo</option>
              <option value="slides">slides</option>
              <option value="doc">doc</option>
              <option value="image">image</option>
              <option value="otro">otro</option>
            </select>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <input
            className="px-3 py-2 rounded-2xl border bg-white"
            placeholder="Título"
            value={title}
            onChange={(e)=>setTitle(e.target.value)}
          />
          <input
            className="px-3 py-2 rounded-2xl border bg-white"
            placeholder="https://…"
            value={url}
            onChange={(e)=>setUrl(e.target.value)}
          />
        </div>

        <div className="grid md:grid-cols-2 gap-3 mt-3">
          <input
            className="px-3 py-2 rounded-2xl border bg-white"
            placeholder="Proveedor (auto)"
            value={provider}
            onChange={(e)=>setProvider(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <BtnPrimary onClick={createItem}>Añadir</BtnPrimary>
            <Btn onClick={()=>{ setTitle(''); setUrl(''); setRank(0); setTipo(''); setProvider(''); }}>
              Limpiar
            </Btn>
          </div>
        </div>
      </div>

      {/* Tabla de resultados */}
      <div className="rounded-2xl border bg-white overflow-x-auto shadow-sm">
        <table className="min-w-[960px] w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-3 py-2">Materia</th>
              <th className="text-left px-3 py-2">Bloque</th>
              <th className="text-left px-3 py-2">Título</th>
              <th className="text-left px-3 py-2">URL</th>
              <th className="text-left px-3 py-2 w-24">Rank</th>
              <th className="text-left px-3 py-2 w-28">Tipo</th>
              <th className="text-left px-3 py-2">Proveedor</th>
              <th className="text-right px-3 py-2 w-36">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-3 py-3 text-slate-500" colSpan={8}>Cargando…</td></tr>
            ) : err ? (
              <tr><td className="px-3 py-3 text-rose-700" colSpan={8}>⚠️ {err}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td className="px-3 py-3 text-slate-500" colSpan={8}>Sin resultados</td></tr>
            ) : rows.map(it => {
              const subjectName = it.subject_name || it.subject_slug || '—';
              const blockLabel =
                it.block_title ||
                (it.block_order != null ? `Bloque ${it.block_order}` : (it.block_code || String(it.block_id).slice(0,8)));
              return (
                <tr key={it.id} className="border-t">
                  <td className="px-3 py-2 whitespace-nowrap">{subjectName}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{blockLabel}</td>
                  <td className="px-3 py-2">
                    <input
                      className="w-full px-2 py-1 rounded border"
                      defaultValue={it.title}
                      onBlur={(e)=>updateItem(it.id, { title: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="w-full px-2 py-1 rounded border"
                      defaultValue={it.url}
                      onBlur={(e)=>updateItem(it.id, { url: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      className="w-24 px-2 py-1 rounded border"
                      defaultValue={it.rank ?? 0}
                      onBlur={(e)=>updateItem(it.id, { rank: Number(e.target.value) })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="w-28 px-2 py-1 rounded border bg-white"
                      defaultValue={it.tipo || 'web'}
                      onBlur={(e)=>updateItem(it.id, { tipo: e.target.value })}
                    >
                      <option value="web">web</option>
                      <option value="pdf">pdf</option>
                      <option value="video">video</option>
                      <option value="repo">repo</option>
                      <option value="slides">slides</option>
                      <option value="doc">doc</option>
                      <option value="image">image</option>
                      <option value="otro">otro</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="w-full px-2 py-1 rounded border"
                      defaultValue={it.provider || ''}
                      onBlur={(e)=>updateItem(it.id, { provider: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex gap-2">
                      <a href={it.url} target="_blank" rel="noreferrer" className="px-3 py-1 rounded border bg-white hover:bg-slate-50">Ver</a>
                      <button onClick={()=>deleteItem(it.id)} className="px-3 py-1 rounded bg-rose-600 text-white hover:bg-rose-700">Borrar</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div className="flex items-center justify-between text-sm">
        <div className="px-3 py-1 rounded-full bg-slate-50 border">
          Página {page} / {totalPages} · Registros {total}
        </div>
        <div className="flex items-center gap-2">
          <label>Por página:</label>
          <select
            value={pageSize}
            onChange={(e)=>{ setPageSize(Number(e.target.value)); setPage(1); }}
            className="px-3 py-1.5 rounded-xl border bg-white"
          >
            {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <Btn onClick={()=>setPage(p=>Math.max(1, p-1))} disabled={page<=1}>‹ Anterior</Btn>
          <Btn onClick={()=>setPage(p=>Math.min(totalPages, p+1))} disabled={page>=totalPages}>Siguiente ›</Btn>
        </div>
      </div>
    </div>
  );
}
