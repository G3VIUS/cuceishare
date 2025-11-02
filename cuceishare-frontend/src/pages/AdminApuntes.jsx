import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';

const API =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3001';

const cx = (...xs) => xs.filter(Boolean).join(' ');

/* UI */
const Btn = ({ className = '', ...p }) => (
  <button
    {...p}
    className={cx(
      'inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-base border shadow-sm',
      'bg-white hover:bg-slate-50',
      className
    )}
  />
);
const BtnPrimary = ({ className = '', ...p }) => (
  <button
    {...p}
    className={cx(
      'inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-base font-semibold text-white shadow-sm',
      'bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60',
      className
    )}
  />
);
const Input = (p) => (
  <input
    {...p}
    className={cx(
      'w-full px-3 py-2 rounded-2xl border bg-white text-base',
      'focus:outline-none focus:ring-2 focus:ring-indigo-300',
      p.className
    )}
  />
);
const Select = (p) => (
  <select
    {...p}
    className={cx(
      'w-full px-3 py-2 rounded-2xl border bg-white text-base',
      'focus:outline-none focus:ring-2 focus:ring-indigo-300',
      p.className
    )}
  />
);

export default function AdminApuntes() {
  // --- sesión/rol (NO retornar antes de los hooks)
  const token = localStorage.getItem('token') || '';
  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('usuario')); } catch { return null; }
  }, []);
  const role = (user?.tipo || user?.role || '').toLowerCase();

  // headers estables
  const headers = useMemo(
    () => ({ Authorization: `Bearer ${token}` }),
    [token]
  );

  // estado/filtros
  const [q, setQ] = useState('');
  const [order, setOrder] = useState('recientes');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // datos
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const params = new URLSearchParams({
        q: q || '',
        page: String(page),
        pageSize: String(pageSize),
        order: order || 'recientes',
      });
      const r = await fetch(`${API}/admin/apuntes?${params.toString()}`, { headers });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      setRows(Array.isArray(j.items) ? j.items : []);
      setTotal(j.total || 0);
    } catch (e) {
      setErr(e.message || 'No se pudo cargar');
    } finally {
      setLoading(false);
    }
  }, [q, order, page, pageSize, headers]);

  useEffect(() => { load(); }, [load]);

  const borrar = async (id) => {
    if (!window.confirm('¿Eliminar este apunte definitivamente?')) return;
    try {
      const r = await fetch(`${API}/admin/apuntes/${id}`, {
        method: 'DELETE',
        headers,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // --- render (guardia después de hooks)
  if (!token || role !== 'admin') {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="rounded-2xl border bg-amber-50 text-amber-800 px-4 py-3 text-base">
          Debes iniciar sesión como <b>admin</b> para ver esta página.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold tracking-tight">⚙️ Admin · Apuntes</h1>
        <div className="flex gap-3">
          <Link to="/admin/contenido">
            <Btn className="text-indigo-700 border-indigo-200">Ir a Contenido</Btn>
          </Link>
          <Link to="/">
            <Btn>Volver</Btn>
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Buscar por título/autor/descr…"
          value={q}
          onChange={(e)=>{ setQ(e.target.value); setPage(1); }}
          style={{ maxWidth: 360 }}
        />
        <Select value={order} onChange={(e)=>{ setOrder(e.target.value); setPage(1); }} style={{ width: 220 }}>
          <option value="recientes">Más recientes</option>
          <option value="antiguos">Más antiguos</option>
          <option value="titulo">Por título (A→Z)</option>
        </Select>
        <BtnPrimary onClick={load}>Buscar</BtnPrimary>
        <span className="ml-auto text-sm text-slate-500">Total: {total}</span>
      </div>

      {err && <div className="rounded-2xl border bg-rose-50 text-rose-800 px-4 py-3">{err}</div>}

      <div className="rounded-2xl border overflow-x-auto bg-white">
        <table className="min-w-[940px] w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left w-[64px]">ID</th>
              <th className="px-3 py-2 text-left">Título</th>
              <th className="px-3 py-2 text-left">Autor</th>
              <th className="px-3 py-2 text-left">Materia</th>
              <th className="px-3 py-2 text-left">Visibilidad</th>
              <th className="px-3 py-2 text-right w-[220px]">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="p-4 text-slate-500" colSpan={6}>Cargando…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td className="p-4 text-slate-500" colSpan={6}>Sin resultados</td></tr>
            ) : rows.map(a => (
              <tr key={a.id} className="border-t">
                <td className="px-3 py-2 text-slate-500">{a.id}</td>
                <td className="px-3 py-2">{a.titulo}</td>
                <td className="px-3 py-2">{a.autor}</td>
                <td className="px-3 py-2">{a.subject_slug || a.materia || '—'}</td>
                <td className="px-3 py-2">{a.visibilidad || 'public'}</td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-2">
                    <Link to={`/apunte/${a.id}`} className="px-3 py-1.5 rounded-xl border hover:bg-slate-50">Ver</Link>
                    <Link to={`/apunte/${a.id}/editar`} className="px-3 py-1.5 rounded-xl border hover:bg-slate-50">Editar</Link>
                    <button onClick={() => borrar(a.id)} className="px-3 py-1.5 rounded-xl bg-rose-600 text-white hover:bg-rose-700">
                      Borrar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* paginación */}
      <div className="flex items-center justify-between text-sm">
        <div className="px-3 py-1.5 rounded-full bg-slate-50 border">
          Página {page} / {totalPages} · Registros {total}
        </div>
        <div className="flex items-center gap-2">
          <label>Por página:</label>
          <Select value={pageSize} onChange={(e)=>{ setPageSize(Number(e.target.value)); setPage(1); }} style={{ width: 110 }}>
            {[10,20,50,100].map(n => <option key={n} value={n}>{n}</option>)}
          </Select>
          <Btn onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page<=1}>‹ Anterior</Btn>
          <Btn onClick={()=>setPage(p=>p+1)} disabled={(page*pageSize)>=total}>Siguiente ›</Btn>
        </div>
      </div>
    </div>
  );
}
