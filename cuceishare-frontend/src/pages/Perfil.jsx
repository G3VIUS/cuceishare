// src/pages/Perfil.jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

/* ============================
   Config
============================= */
const API =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3001';

const cx = (...xs) => xs.filter(Boolean).join(' ');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* ── Badge de clasificación IA ── */
const BADGE_STYLES = {
  'Excelente':  { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300', icon: '🏆' },
  'Incompleto': { bg: 'bg-amber-100',   text: 'text-amber-800',   border: 'border-amber-300',   icon: '⚠️' },
  'Erróneo':    { bg: 'bg-rose-100',    text: 'text-rose-800',    border: 'border-rose-300',     icon: '❌' },
};
function ClasificacionBadge({ resultado, confianza }) {
  if (!resultado) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border bg-slate-100 text-slate-400 text-xs">
        🤖 Sin clasificación
      </span>
    );
  }
  const style = BADGE_STYLES[resultado] || { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', icon: '🤖' };
  const pct = confianza != null ? ` · ${Math.round(confianza * 100)}%` : '';
  return (
    <span className={cx(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold',
      style.bg, style.text, style.border
    )}>
      {style.icon} {resultado}{pct}
    </span>
  );
}

/* ============================
   UI helpers
============================= */
function Card({ className = '', children }) {
  return (
    <div className={cx('bg-white rounded-2xl border shadow-sm', className)}>
      {children}
    </div>
  );
}
function SectionHeader({ title, subtitle, right }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b">
      <div>
        <h3 className="text-lg font-bold">{title}</h3>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}
function Field({ label, error, children, hint, required }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-slate-700">
        {label} {required && <span className="text-rose-600">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-rose-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}
function Stat({ label, value, icon }) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl border bg-slate-50">
      <div className="h-10 w-10 grid place-items-center rounded-lg bg-indigo-100 text-indigo-700 text-lg">{icon}</div>
      <div>
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-base font-semibold">{value}</div>
      </div>
    </div>
  );
}
function Skeleton({ className = '' }) {
  return <div className={cx('animate-pulse bg-slate-200 rounded', className)} />;
}

/* ============================
   Main
============================= */
export default function Perfil() {
  const navigate = useNavigate();

  // Sesión
  const sesion = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('usuario')); } catch { return null; }
  }, []);
  const token = localStorage.getItem('token');
  const username = sesion?.username || sesion?.user || `user-${sesion?.id ?? ''}`;
  const role = sesion?.tipo || sesion?.role || 'estudiante';

  // Campos estables para deps
  const sesionId = sesion?.id ?? null;
  const sesionUsername = sesion?.username || role || username;

  // Headers
  const headers = useMemo(() => {
    const h = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  }, [token]);

  // Perfil
  const [profileLoading, setProfileLoading] = useState(true);
  const [form, setForm] = useState({
    nombre: '', apellido: '', matricula: '', carrera: '', semestre: '', telefono: '',
    correo: '', avatar_url: ''
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState('');
  const [saveError, setSaveError] = useState('');

  // Apuntes
  const [apuntes, setApuntes] = useState([]);
  const [apLoading, setApLoading] = useState(true);
  const [apError, setApError] = useState('');
  const [apQuery, setApQuery] = useState('');
  const [apSort, setApSort] = useState('recientes'); // 'recientes' | 'titulo'
  // Clasificaciones IA: { [apunteId]: { resultado, confianza } | null }
  const [clasificaciones, setClasificaciones] = useState({});
  const fileInputRef = useRef(null);

  // Guard
  useEffect(() => {
    if (!token) navigate('/login', { replace: true });
  }, [token, navigate]);

  // Cargar perfil + apuntes (sin 'API' en deps: constante de módulo)
  useEffect(() => {
    if (!token) return;

    const acProfile = new AbortController();
    const acNotes = new AbortController();
    let alive = true;

    // Perfil
    (async () => {
      setProfileLoading(true);
      try {
        const r = await fetch(`${API}/auth/me`, { headers, signal: acProfile.signal });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
        if (!alive) return;
        const p = j?.perfil || {};
        setForm(f => ({
          ...f,
          nombre: p.nombre || '',
          apellido: p.apellido || '',
          matricula: p.matricula || '',
          carrera: p.carrera || '',
          semestre: p.semestre || '',
          telefono: p.telefono || '',
          correo: p.correo || '',
          avatar_url: p.avatar_url || ''
        }));
      } catch (e) {
        if (e.name !== 'AbortError') console.warn('[perfil] load:', e?.message);
      } finally {
        if (alive) setProfileLoading(false);
      }
    })();

    // Apuntes
    (async () => {
      setApLoading(true);
      try {
        const res = await fetch(`${API}/apuntes`, { headers, signal: acNotes.signal });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
        if (!alive) return;
        const arr = Array.isArray(json) ? json :
          (Array.isArray(json.apuntes) ? json.apuntes : (json.items || []));
        const propios = role === 'admin' ? arr : arr.filter(a =>
          a.autor === sesionUsername ||
          a.user === sesionUsername ||
          a.usuario === sesionUsername ||
          a.usuario_id === sesionId
        );
        setApuntes(propios);

        // Cargar clasificaciones IA para cada apunte (en paralelo, silencioso)
        if (propios.length > 0) {
          const entries = await Promise.all(
            propios.map(async (a) => {
              try {
                const r = await fetch(`${API}/apuntes/${a.id}/clasificacion`, { headers });
                if (!r.ok) return [a.id, null];
                const data = await r.json().catch(() => null);
                return [a.id, data];
              } catch {
                return [a.id, null];
              }
            })
          );
          if (alive) {
            setClasificaciones(Object.fromEntries(entries));
          }
        }
      } catch (e) {
        if (e.name === 'AbortError') return;
        setApError(e.message || 'No se pudieron cargar los apuntes');
      } finally {
        if (alive) setApLoading(false);
      }
    })();

    return () => {
      alive = false;
      acProfile.abort();
      acNotes.abort();
    };
  }, [headers, role, sesionId, sesionUsername, token]);

  /* -------- Perfil: validación & progreso -------- */
  const requiredOk = (v) => String(v || '').trim().length > 0;
  const validate = () => {
    const e = {};
    if (!requiredOk(form.nombre)) e.nombre = 'Requerido';
    if (!requiredOk(form.apellido)) e.apellido = 'Requerido';
    if (form.semestre && !/^\d+$/.test(String(form.semestre))) e.semestre = 'Debe ser número';
    if (form.correo && !/^\S+@\S+\.\S+$/.test(form.correo)) e.correo = 'Correo inválido';
    if (form.telefono && !/^[\d\-\s()+.]+$/.test(form.telefono)) e.telefono = 'Teléfono inválido';
    return e;
  };
  const completion = (() => {
    const keys = ['nombre','apellido','matricula','carrera','semestre','telefono','correo'];
    const filled = keys.filter(k => requiredOk(form[k])).length;
    return Math.round((filled / keys.length) * 100);
  })();

  /* -------- Perfil: guardar -------- */
  async function onSave(e) {
    e?.preventDefault?.();
    setSaved(''); setSaveError('');
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length) { setSaveError('Corrige los campos marcados'); return; }

    try {
      setSaving(true);
      const r = await fetch(`${API}/auth/profile`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(form),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      setSaved('Datos guardados');
      await sleep(1500);
      setSaved('');
    } catch (e) {
      setSaveError(e.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  /* -------- Avatar: simple por URL + preview local -------- */
  function onPickAvatarFile(ev) {
    const file = ev.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    // Nota: no subimos archivo (no hay endpoint). Solo preview y asignación al campo:
    setForm(prev => ({ ...prev, avatar_url: url }));
  }

  /* -------- Apuntes: acciones -------- */
  const filteredApuntes = useMemo(() => {
    const q = apQuery.trim().toLowerCase();
    let list = apuntes;
    if (q) {
      list = list.filter(a =>
        String(a.titulo || a.title || '').toLowerCase().includes(q) ||
        String(a.descripcion || a.description || '').toLowerCase().includes(q)
      );
    }
    if (apSort === 'titulo') {
      list = [...list].sort((a, b) => String(a.titulo || a.title || '')
        .localeCompare(String(b.titulo || b.title || '')));
    } else {
      // recientes: intenta created_at / id descendente
      list = [...list].sort((a, b) =>
        String(b.created_at || b.creado_en || b.id || '').localeCompare(String(a.created_at || a.creado_en || a.id || ''))
      );
    }
    return list;
  }, [apQuery, apSort, apuntes]);

  async function handleDelete(id) {
    if (!window.confirm('¿Seguro que quieres eliminar este apunte?')) return;
    try {
      const res = await fetch(`${API}/apuntes/${id}`, { method: 'DELETE', headers });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      setApuntes(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      alert(`No se pudo borrar: ${err.message}`);
    }
  }

  if (!token) {
    return (
      <div className="p-6 text-center">
        <p className="text-rose-600">No has iniciado sesión.</p>
        <button
          onClick={() => navigate('/login')}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg"
        >
          Ir al login
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* App bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Perfil
          </h2>
          <p className="text-slate-500 text-sm">
            Completa tu información para personalizar tu ruta de aprendizaje.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/subir" className="px-3 py-2 rounded-xl bg-indigo-600 text-white font-medium shadow-sm">
            ➕ Subir apunte
          </Link>
          <button
            onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('usuario'); navigate('/login'); }}
            className="px-3 py-2 rounded-xl bg-slate-200 text-slate-800 font-medium"
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid sm:grid-cols-3 gap-3">
        <Stat label="Usuario" value={username} icon="👤" />
        <Stat label="Rol" value={role} icon="🎓" />
        <div className="p-4 rounded-xl border bg-slate-50">
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-500">Compleción del perfil</div>
            <div className="text-xs text-slate-500">{completion}%</div>
          </div>
          <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
            <div className="h-2 bg-indigo-600 rounded-full transition-[width] duration-500" style={{ width: `${completion}%` }} />
          </div>
        </div>
      </div>

      {/* Perfil Card */}
      <Card>
        <SectionHeader
          title="Datos personales"
          subtitle="Solo se usan para personalizar tu experiencia."
          right={
            <div className="flex items-center gap-3">
              {saved && <span className="text-emerald-700 text-sm">✅ {saved}</span>}
              {saveError && <span className="text-rose-700 text-sm">⚠️ {saveError}</span>}
              <button
                onClick={onSave}
                disabled={saving}
                className={cx(
                  'px-4 py-2 rounded-xl text-white font-semibold shadow-sm',
                  saving ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'
                )}
              >
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          }
        />

        <div className="p-5 grid lg:grid-cols-[220px_1fr] gap-6">
          {/* Avatar */}
          <div className="space-y-3">
            <div className="relative">
              <div className="aspect-square w-40 rounded-2xl overflow-hidden border bg-slate-100">
                {profileLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : form.avatar_url ? (
                  // eslint-disable-next-line jsx-a11y/img-redundant-alt
                  <img src={form.avatar_url} alt="Avatar preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full grid place-items-center text-4xl">🧑🏻‍💻</div>
                )}
              </div>
              <div className="mt-3 grid gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onPickAvatarFile}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 px-3 py-2 rounded-lg border bg-white hover:bg-slate-50"
                    type="button"
                  >
                    Subir imagen
                  </button>
                  <button
                    onClick={() => setForm(prev => ({ ...prev, avatar_url: '' }))}
                    className="px-3 py-2 rounded-lg border bg-white hover:bg-slate-50"
                    type="button"
                  >
                    Quitar
                  </button>
                </div>
                <Field hint="O pega una URL pública:">
                  <input
                    className="w-full px-3 py-2 rounded-lg border"
                    placeholder="https://…/avatar.png"
                    value={form.avatar_url}
                    onChange={(e) => setForm(prev => ({ ...prev, avatar_url: e.target.value }))}
                  />
                </Field>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={onSave} className="grid md:grid-cols-2 gap-4">
            <Field label="Nombre" required error={errors.nombre}>
              <input
                className="w-full px-3 py-2 rounded-lg border"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Tu nombre"
              />
            </Field>
            <Field label="Apellido" required error={errors.apellido}>
              <input
                className="w-full px-3 py-2 rounded-lg border"
                value={form.apellido}
                onChange={(e) => setForm({ ...form, apellido: e.target.value })}
                placeholder="Tu apellido"
              />
            </Field>
            <Field label="Matrícula">
              <input
                className="w-full px-3 py-2 rounded-lg border"
                value={form.matricula}
                onChange={(e) => setForm({ ...form, matricula: e.target.value })}
                placeholder="Ej. 21234567"
              />
            </Field>
            <Field label="Carrera">
              <input
                className="w-full px-3 py-2 rounded-lg border"
                value={form.carrera}
                onChange={(e) => setForm({ ...form, carrera: e.target.value })}
                placeholder="Ing. Informática"
              />
            </Field>
            <Field label="Semestre">
              <input
                className="w-full px-3 py-2 rounded-lg border"
                value={form.semestre}
                onChange={(e) => setForm({ ...form, semestre: e.target.value })}
                placeholder="6"
              />
            </Field>
            <Field label="Teléfono" error={errors.telefono}>
              <input
                className="w-full px-3 py-2 rounded-lg border"
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                placeholder="33-xxxx-xxxx"
              />
            </Field>
            <Field label="Correo" error={errors.correo}>
              <input
                className="w-full px-3 py-2 rounded-lg border"
                value={form.correo}
                onChange={(e) => setForm({ ...form, correo: e.target.value })}
                placeholder="tucorreo@cucei.mx"
              />
            </Field>
            <div className="md:col-span-2">
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className={cx(
                    'px-4 py-2 rounded-xl text-white font-semibold shadow-sm',
                    saving ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'
                  )}
                >
                  {saving ? 'Guardando…' : 'Guardar cambios'}
                </button>
                {saved && <span className="text-emerald-700 text-sm">✅ {saved}</span>}
                {saveError && !saved && <span className="text-rose-700 text-sm">⚠️ {saveError}</span>}
              </div>
            </div>
          </form>
        </div>
      </Card>

      {/* Apuntes Card */}
      <Card>
        <SectionHeader
          title="Mis apuntes"
          subtitle="Administra tus materiales publicados."
          right={
            <div className="flex flex-wrap gap-2">
              <input
                className="px-3 py-2 rounded-lg border w-48"
                placeholder="Buscar…"
                value={apQuery}
                onChange={e => setApQuery(e.target.value)}
                aria-label="Buscar apuntes"
              />
              <select
                className="px-3 py-2 rounded-lg border bg-white"
                value={apSort}
                onChange={e => setApSort(e.target.value)}
                aria-label="Ordenar"
              >
                <option value="recientes">Más recientes</option>
                <option value="titulo">Por título (A→Z)</option>
              </select>
            </div>
          }
        />
        <div className="p-5">
          {apLoading ? (
            <div className="grid gap-3">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : apError ? (
            <div className="rounded-xl border bg-rose-50 text-rose-800 p-4">⚠️ {apError}</div>
          ) : filteredApuntes.length === 0 ? (
            <div className="rounded-xl border bg-slate-50 text-slate-700 p-6 text-center">
              No hay apuntes que coincidan.
            </div>
          ) : (
            <ul className="divide-y">
              {filteredApuntes.map((a) => {
                const title = a.titulo || a.title || `Apunte #${a.id}`;
                const desc = a.descripcion || a.description || '';
                const meta = a.created_at || a.creado_en || '';
                return (
                  <li key={a.id} className="py-4 flex gap-4 items-start">
                    <div className="h-12 w-12 grid place-items-center rounded-lg bg-indigo-50 text-indigo-700">📄</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link to={`/apunte/${a.id}`} className="font-semibold hover:underline truncate">
                          {title}
                        </Link>
                        <span className="text-xs text-slate-400 truncate">{String(meta).slice(0, 19)}</span>
                        {/* Badge IA */}
                        <ClasificacionBadge
                          resultado={clasificaciones[a.id]?.resultado ?? null}
                          confianza={clasificaciones[a.id]?.confianza ?? null}
                        />
                      </div>
                      <p className="text-sm text-slate-600 line-clamp-2">{desc}</p>
                    </div>
                    <div className="shrink-0 flex gap-2">
                      <Link
                        to={`/apuntes/${a.id}/editar`}
                        className="px-3 py-1.5 rounded-lg border bg-white hover:bg-slate-50 text-slate-800"
                      >
                        ✏️ Editar
                      </Link>
                      <button
                        onClick={() => handleDelete(a.id)}
                        className="px-3 py-1.5 rounded-lg border bg-white hover:bg-slate-50 text-rose-700"
                      >
                        🗑️ Borrar
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Card>

      {/* Tips */}
      <div className="grid md:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl border bg-white">
          <div className="text-lg">🔒</div>
          <div className="font-semibold">Privacidad</div>
          <p className="text-sm text-slate-600">
            Tu información solo se usa para personalizar tu experiencia de estudio.
          </p>
        </div>
        <div className="p-4 rounded-2xl border bg-white">
          <div className="text-lg">💾</div>
          <div className="font-semibold">Guarda cambios</div>
          <p className="text-sm text-slate-600">
            Revisa los campos requeridos (Nombre y Apellido) antes de guardar.
          </p>
        </div>
        <div className="p-4 rounded-2xl border bg-white">
          <div className="text-lg">💡</div>
          <div className="font-semibold">Avatar</div>
          <p className="text-sm text-slate-600">
            Puedes subir una imagen local (solo vista previa) o pegar una URL pública.
          </p>
        </div>
      </div>
    </div>
  );
}
