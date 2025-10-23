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

export default function AdminApuntes() {
  const navigate = useNavigate();

  // sesión/role (NO hooks condicionales)
  const token = localStorage.getItem('token') || '';
  let role = '';
  try { role = JSON.parse(localStorage.getItem('usuario'))?.tipo || ''; } catch {}
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const notAdmin = !token || String(role).toLowerCase() !== 'admin';

  // listado estado
  const [q, setQ] = useState('');
  const [order, setOrder] = useState('recientes'); // recientes | antiguos | titulo
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const params = new URLSearchParams({
        q, order,
        page: String(page),
        pageSize: String(pageSize),
      });
      const r = await fetch(`${API}/admin/apuntes?${params.toString()}`, { headers });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      setRows(Array.isArray(j.items) ? j.items : []);
      setTotal(j.total || 0);
    } catch (e) {
      setErr(e.message || 'No se pudo cargar');
      setRows([]); setTotal(0);
    } finally { setLoading(false); }
  }, [q, order, page, pageSize, headers]);

  useEffect(() => { load(); }, [load]);

  const borrar = async (id) => {
    if (!window.confirm('¿Eliminar este apunte definitivamente?')) return;
    const r = await fetch(`${API}/admin/apuntes/${id}`, { method: 'DELETE', headers });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return alert(j?.error || `HTTP ${r.status}`);
    await load();
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 space-y-5">
      {/* Header y tabs grandes */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            ⚙️ Admin · Apuntes
          </h1>
          <p className="text-slate-500 text-sm">Revisa, edita y elimina apuntes.</p>
        </div>
        <div className="flex gap-2">
          <PillLink to="/admin/apuntes" active>📄 Admin Apuntes</PillLink>
          <PillLink to="/admin/contenido" active={false}>📚 Admin Contenido</PillLink>
          <Btn onClick={() => navigate('/')}>Volver</Btn>
        </div>
      </div>

      {notAdmin && (
        <div className="rounded-xl border bg-amber-50 text-amber-800 p-4">
          Debes iniciar sesión como <b>admin</b> para ver este panel.
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e)=>{ setQ(e.target.value); setPage(1); }}
          placeholder="Buscar título, autor o descripción…"
          className="px-3 py-2 rounded-2xl border bg-white w-72"
        />
        <select
          value={order}
          onChange={(e)=>{ setOrder(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-2xl border bg-white"
        >
          <option value="recientes">Más recientes</option>
          <option value="antiguos">Más antiguos</option>
          <option value="titulo">Por título (A→Z)</option>
        </select>
        <Btn onClick={load}>Buscar</Btn>
        <span className="text-xs text-slate-500 ml-auto">Total: {total}</span>
      </div>

      {/* Tabla */}
      <div className="rounded-2xl border bg-white overflow-x-auto shadow-sm">
        <table className="min-w-[860px] w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-3 py-2 w-16">ID</th>
              <th className="text-left px-3 py-2">Título</th>
              <th className="text-left px-3 py-2">Autor</th>
              <th className="text-left px-3 py-2">Materia</th>
              <th className="text-left px-3 py-2">Visib.</th>
              <th className="text-right px-3 py-2 w-40">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-3 py-3 text-slate-500" colSpan={6}>Cargando…</td></tr>
            ) : err ? (
              <tr><td className="px-3 py-3 text-rose-700" colSpan={6}>⚠️ {err}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td className="px-3 py-3 text-slate-500" colSpan={6}>Sin resultados</td></tr>
            ) : rows.map(a => (
              <tr key={a.id} className="border-t">
                <td className="px-3 py-2 text-slate-500">{a.id}</td>
                <td className="px-3 py-2">{a.titulo}</td>
                <td className="px-3 py-2">{a.autor}</td>
                <td className="px-3 py-2">{a.subject_slug || a.materia || ''}</td>
                <td className="px-3 py-2">{a.visibilidad || 'public'}</td>
                <td className="px-3 py-2 text-right">
                  <div className="inline-flex gap-2">
                    <Link to={`/apunte/${a.id}/editar`} className="px-3 py-1 rounded border bg-white hover:bg-slate-50">
                      Editar
                    </Link>
                    <button onClick={()=>borrar(a.id)} className="px-3 py-1 rounded bg-rose-600 text-white hover:bg-rose-700">
                      Borrar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
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
