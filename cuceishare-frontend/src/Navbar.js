// src/Navbar.jsx
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

// Usa los slugs de ruta reales (coinciden con App.js)
const SUBJECTS = [
  { slug: 'ed1',            nombre: 'Estructuras de Datos I' },
  { slug: 'aserv',          nombre: 'Administración de Servidores' },
  { slug: 'mineria-datos',  nombre: 'Minería de Datos' },
  { slug: 'redes',          nombre: 'Redes' },
  { slug: 'algoritmia',     nombre: 'Algoritmia' },
  { slug: 'teoria',         nombre: 'Teoría de la Computación' },
];

const LS_SUBJECT = 'lastSubjectSlug';

export default function Navbar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // sesión
  const token = localStorage.getItem('token');
  const legacyUser = localStorage.getItem('usuario');
  const isAuthed = !!token || !!legacyUser;

  // subject inicial (URL -> LS -> fallback)
  const initialSubject = useMemo(() => {
    const parts = pathname.split('/').filter(Boolean);
    const slugFromUrl =
      ['pre-eval', 'ruta', 'content', 'practice'].includes(parts[0]) ? parts[1] : null;
    const stored = localStorage.getItem(LS_SUBJECT);
    const fallback = SUBJECTS[0].slug;
    const candidate = slugFromUrl || stored || fallback;
    return SUBJECTS.some(s => s.slug === candidate) ? candidate : fallback;
  }, [pathname]);

  const [subject, setSubject] = useState(initialSubject);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Persiste selección
  useEffect(() => {
    localStorage.setItem(LS_SUBJECT, subject);
  }, [subject]);

  // Sincroniza si entras directo por URL
  useEffect(() => {
    const parts = pathname.split('/').filter(Boolean);
    const slugFromUrl =
      ['pre-eval', 'ruta', 'content', 'practice'].includes(parts[0]) ? parts[1] : null;
    if (slugFromUrl && SUBJECTS.some(s => s.slug === slugFromUrl) && slugFromUrl !== subject) {
      setSubject(slugFromUrl);
    }
  }, [pathname, subject]);

  const current = SUBJECTS.find(s => s.slug === subject) ?? SUBJECTS[0];

  const goPreEval = () => { setMobileOpen(false); navigate(`/pre-eval/${current.slug}`); };
  const goRuta    = () => { setMobileOpen(false); navigate(`/ruta/${current.slug}`); };
  const goBuscar  = () => { setMobileOpen(false); navigate(`/buscar?materia=${current.slug}`); };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    SUBJECTS.forEach(s => {
      localStorage.removeItem(`${s.slug}:preeval:draft`);
      localStorage.removeItem(`${s.slug}:route:progress`);
    });
    setMobileOpen(false);
    navigate('/login');
  };

  const btn = "text-sm px-3 py-1.5 rounded-md border hover:bg-slate-50";
  const btnPrimary = "text-sm px-3 py-1.5 rounded-md bg-slate-900 text-white hover:bg-black";

  return (
    <header className="sticky top-0 z-50 backdrop-blur supports-[backdrop-filter]:bg-white/70 bg-white/90 border-b">
      <nav className="max-w-7xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between">
        {/* Marca */}
        <div className="flex items-center gap-3">
          <Link to="/" className="text-[15px] font-semibold tracking-tight text-slate-900">
            CUCEIShare
          </Link>

            {/* Selector (desktop) */}
            <div className="hidden md:flex items-center gap-2">
              <label htmlFor="subject" className="sr-only">Materia</label>
              <select
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="text-sm border rounded-md px-2 py-1 bg-white"
                title="Materia"
              >
                {SUBJECTS.map(s => (
                  <option key={s.slug} value={s.slug}>{s.nombre}</option>
                ))}
              </select>
            </div>
        </div>

        {/* Acciones (desktop) */}
        <div className="hidden md:flex items-center gap-2">
          <button onClick={goPreEval} className={btn} title="Pre-evaluación">Pre-evaluación</button>
          <button onClick={goRuta} className={btnPrimary} title="Mi ruta">Mi ruta</button>
          <button onClick={goBuscar} className={btn} title="Explorar apuntes">Apuntes</button>
          {isAuthed ? (
            <button onClick={handleLogout} className="text-sm text-slate-500 hover:text-slate-900 ml-1" title="Cerrar sesión">
              Salir
            </button>
          ) : (
            <Link to="/login" className="text-sm text-slate-500 hover:text-slate-900 ml-1">Entrar</Link>
          )}
        </div>

        {/* Botón menú (mobile) */}
        <div className="md:hidden">
          <button
            aria-label="Abrir menú"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(o => !o)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-slate-50"
          >
            <span className="sr-only">Menu</span>
            <span className="block h-0.5 w-4 bg-slate-900 mb-1" />
            <span className="block h-0.5 w-4 bg-slate-900 mb-1" />
            <span className="block h-0.5 w-4 bg-slate-900" />
          </button>
        </div>
      </nav>

      {/* Panel móvil */}
      {mobileOpen && (
        <div className="md:hidden border-t bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-3 py-3 space-y-3">
            {/* Selector móvil */}
            <div>
              <label className="block text-xs text-slate-500 mb-1">Materia</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-md border bg-white px-3 py-2 text-sm"
              >
                {SUBJECTS.map(s => (
                  <option key={s.slug} value={s.slug}>{s.nombre}</option>
                ))}
              </select>
            </div>

            {/* Acciones */}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={goPreEval} className="rounded-md border px-3 py-2 text-sm">Pre-evaluación</button>
              <button onClick={goRuta} className="rounded-md bg-slate-900 text-white px-3 py-2 text-sm">Mi ruta</button>
              <button onClick={goBuscar} className="rounded-md border px-3 py-2 text-sm col-span-2">Apuntes</button>
            </div>

            {/* Sesión */}
            <div className="pt-1">
              {isAuthed ? (
                <button onClick={handleLogout} className="text-sm text-slate-500 hover:text-slate-900">
                  Cerrar sesión
                </button>
              ) : (
                <Link to="/login" onClick={() => setMobileOpen(false)} className="text-sm text-slate-500 hover:text-slate-900">
                  Iniciar sesión
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
