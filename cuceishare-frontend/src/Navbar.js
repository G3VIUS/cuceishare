// src/Navbar.jsx
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useLocation, useParams } from 'react-router-dom';

const SUBJECTS = [
  { slug: 'ed1', nombre: 'Estructuras de Datos I' },
  { slug: 'administracion-servidores', nombre: 'Administración de Servidores' },
  // Agrega más aquí:
  // { slug: 'mineria-datos', nombre: 'Minería de Datos' },
];

const LS_SUBJECT = 'lastSubjectSlug';

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [subjectOpen, setSubjectOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // --- sesión ---
  const token = localStorage.getItem('token');
  const legacyUser = localStorage.getItem('usuario');
  const isAuthed = !!token || !!legacyUser;
  const isAuthPage = pathname === '/login' || pathname === '/register';

  // --- materia activa (persistida) ---
  const initialSubject = useMemo(() => {
    // 1) lee de la URL si estás parado en /pre-eval/:subjectSlug o /ruta/:subjectSlug
    const parts = pathname.split('/').filter(Boolean);
    const slugFromUrl = (parts[0] === 'pre-eval' || parts[0] === 'ruta') ? parts[1] : null;
    const stored = localStorage.getItem(LS_SUBJECT);
    const fallback = 'ed1';
    const candidate = slugFromUrl || stored || fallback;
    return SUBJECTS.some(s => s.slug === candidate) ? candidate : fallback;
  }, [pathname]);

  const [subject, setSubject] = useState(initialSubject);

  useEffect(() => {
    localStorage.setItem(LS_SUBJECT, subject);
  }, [subject]);

  const currentSubject = SUBJECTS.find(s => s.slug === subject) || SUBJECTS[0];

  // --- estilos ---
  const linkBase = 'hover:text-purple-700 transition-colors';
  const active = 'text-purple-700 font-semibold';

  // --- acciones ---
  const handleLogout = () => {
    // limpia todo lo relacionado a sesión y borradores multi-materia
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');

    // borra posibles borradores por materia (por convención usamos `${slug}:preeval:draft`)
    SUBJECTS.forEach(s => {
      localStorage.removeItem(`${s.slug}:preeval:draft`);
      localStorage.removeItem(`${s.slug}:route:progress`);
    });

    navigate('/login');
  };

  const goPreEval = () => navigate(`/pre-eval/${currentSubject.slug}`);

  // Si aún NO tienes ruta genérica, deja fallback a ED1:
  const hasGenericRoute = true; // ponlo en false si aún no creas /ruta/:subjectSlug
  const goRuta = () => {
    if (hasGenericRoute) navigate(`/ruta/${currentSubject.slug}`);
    else navigate('/ruta/ed1');
  };

  return (
    <nav className="bg-white shadow-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="text-xl font-bold text-purple-700 flex items-center gap-2">
          🎓 CUCEIShare
        </Link>

        {/* Materia (desktop) */}
        {isAuthed && (
          <div className="hidden md:flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setSubjectOpen(o => !o)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border bg-white hover:bg-slate-50"
                aria-haspopup="listbox"
                aria-expanded={subjectOpen}
                title="Seleccionar materia"
              >
                📚 {currentSubject.nombre}
                <span className="text-slate-400">▾</span>
              </button>
              {subjectOpen && (
                <div
                  className="absolute left-0 mt-2 w-72 rounded-xl border bg-white shadow-lg p-2"
                  onMouseLeave={() => setSubjectOpen(false)}
                >
                  <ul role="listbox" className="max-h-64 overflow-auto">
                    {SUBJECTS.map(s => (
                      <li key={s.slug}>
                        <button
                          role="option"
                          onClick={() => { setSubjectOpen(false); setSubject(s.slug); }}
                          className={`w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 ${s.slug === subject ? 'bg-slate-100 font-semibold' : ''}`}
                        >
                          {s.nombre}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <button
              onClick={goPreEval}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white font-medium shadow-sm hover:bg-indigo-700"
              title="Ir a la pre-evaluación de la materia seleccionada"
            >
              📊 Pre-evaluación
            </button>
            <button
              onClick={goRuta}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-medium shadow-sm hover:bg-emerald-700"
              title="Ir a mi ruta para la materia seleccionada"
            >
              🗺️ Mi ruta
            </button>
          </div>
        )}

        {/* Hamburguesa (móvil) */}
        <button
          onClick={() => setMenuOpen(o => !o)}
          className="md:hidden text-2xl"
          aria-label="Abrir menú"
        >
          ☰
        </button>
      </div>

      {/* Menú responsive */}
      <div className={`md:hidden ${menuOpen ? 'block' : 'hidden'} border-t`}>
        <div className="px-4 py-3 flex flex-col gap-3 font-medium">
          {/* ---- Sin sesión ---- */}
          {!isAuthed && (
            <>
              {isAuthPage ? (
                <>
                  {pathname === '/login' && <Link to="/register" className={linkBase}>🆕 Registro</Link>}
                  {pathname === '/register' && <Link to="/login" className={linkBase}>🔑 Login</Link>}
                </>
              ) : (
                <>
                  <Link to="/" className={`${linkBase} ${pathname==='/'?active:''}`}>🏠 Inicio</Link>
                  <Link to="/buscar" className={`${linkBase} ${pathname==='/buscar'?active:''}`}>🔍 Buscar</Link>
                  <Link to="/login" className={`${linkBase} ${pathname==='/login'?active:''}`}>🔑 Login</Link>
                  <Link to="/register" className={`${linkBase} ${pathname==='/register'?active:''}`}>🆕 Registro</Link>
                </>
              )}
            </>
          )}

          {/* ---- Con sesión ---- */}
          {isAuthed && (
            <>
              <Link to="/" className={`${linkBase} ${pathname==='/'?active:''}`}>🏠 Inicio</Link>
              <Link to="/buscar" className={`${linkBase} ${pathname==='/buscar'?active:''}`}>🔍 Buscar</Link>
              <Link to="/subir" className={`${linkBase} ${pathname==='/subir'?active:''}`}>📝 Subir Apunte</Link>
              <Link to="/perfil" className={`${linkBase} ${pathname==='/perfil'?active:''}`}>👤 Perfil</Link>

              {/* Selector de materia (móvil) */}
              <div className="pt-2 border-t">
                <div className="text-xs text-slate-500 mb-1">Materia</div>
                <select
                  className="w-full px-3 py-2 rounded-lg border bg-white"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                >
                  {SUBJECTS.map(s => (
                    <option key={s.slug} value={s.slug}>{s.nombre}</option>
                  ))}
                </select>
                <div className="mt-2 flex flex-col gap-2">
                  <button
                    onClick={() => { setMenuOpen(false); goPreEval(); }}
                    className="w-full px-3 py-2 rounded-lg bg-indigo-600 text-white"
                  >
                    📊 Pre-evaluación
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); goRuta(); }}
                    className="w-full px-3 py-2 rounded-lg bg-emerald-600 text-white"
                  >
                    🗺️ Mi ruta
                  </button>
                </div>
              </div>

              <button onClick={handleLogout} className="mt-2 text-left hover:text-red-600 font-semibold">
                🚪 Cerrar sesión
              </button>
            </>
          )}
        </div>
      </div>

      {/* Barra inferior de navegación (desktop links simples) */}
      <div className="hidden md:block border-t">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-6 text-sm">
          <Link to="/" className={`${linkBase} ${pathname==='/'?active:''}`}>🏠 Inicio</Link>
          <Link to="/buscar" className={`${linkBase} ${pathname==='/buscar'?active:''}`}>🔍 Buscar</Link>
          <Link to="/subir" className={`${linkBase} ${pathname==='/subir'?active:''}`}>📝 Subir Apunte</Link>
          <Link to="/perfil" className={`${linkBase} ${pathname==='/perfil'?active:''}`}>👤 Perfil</Link>
          {!isAuthed && (
            <>
              <Link to="/login" className={`${linkBase} ${pathname==='/login'?active:''}`}>🔑 Login</Link>
              <Link to="/register" className={`${linkBase} ${pathname==='/register'?active:''}`}>🆕 Registro</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
