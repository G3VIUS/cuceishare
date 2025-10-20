import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

// Slugs de ruta reales (coinciden con App.js)
const SUBJECTS = [
  { slug: 'ed1',            nombre: 'Estructuras de Datos I' },
  { slug: 'aserv',          nombre: 'Administración de Servidores' },
  { slug: 'mineria-datos',  nombre: 'Minería de Datos' },
  { slug: 'redes',          nombre: 'Redes' },
  { slug: 'algoritmia',     nombre: 'Algoritmia' },
  { slug: 'teoria',         nombre: 'Teoría de la Computación' },
];

const LS_SUBJECT = 'lastSubjectSlug';
const cx = (...xs) => xs.filter(Boolean).join(' ');

export default function Navbar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // sesión
  const token = localStorage.getItem('token');
  const legacyUserStr = localStorage.getItem('usuario');
  const legacyUser = safeParse(legacyUserStr);
  const isAuthed = !!token || !!legacyUserStr;

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
  useEffect(() => { localStorage.setItem(LS_SUBJECT, subject); }, [subject]);

  // Sincroniza si entras directo por URL
  useEffect(() => {
    const parts = pathname.split('/').filter(Boolean);
    const slugFromUrl =
      ['pre-eval', 'ruta', 'content', 'practice'].includes(parts[0]) ? parts[1] : null;
    if (slugFromUrl && SUBJECTS.some(s => s.slug === slugFromUrl) && slugFromUrl !== subject) {
      setSubject(slugFromUrl);
    }
  }, [pathname, subject]);

  // Bloquea scroll cuando el menú está abierto
  useEffect(() => {
    if (mobileOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  // Cierra en cambio de ruta
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Cierra con Esc y al pasar a md en resize
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setMobileOpen(false);
    const onResize = () => { if (window.innerWidth >= 768) setMobileOpen(false); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const current = SUBJECTS.find(s => s.slug === subject) ?? SUBJECTS[0];

  const goPreEval = () => { setMobileOpen(false); navigate(`/pre-eval/${current.slug}`); };
  const goRuta    = () => { setMobileOpen(false); navigate(`/ruta/${current.slug}`); };
  const goBuscar  = () => { setMobileOpen(false); navigate(`/buscar?materia=${current.slug}`); };
  const goLogin   = () => { setMobileOpen(false); navigate('/login'); };

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

  const isActive = (key) => {
    if (key === 'pre')   return pathname.startsWith('/pre-eval/');
    if (key === 'ruta')  return pathname.startsWith('/ruta/');
    if (key === 'buscar')return pathname.startsWith('/buscar');
    return false;
  };

  const btn        = "text-sm px-3 py-2 rounded-md border hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300";
  const btnPrimary = "text-sm px-3 py-2 rounded-md bg-slate-900 text-white hover:bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400";

  return (
    <header className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70 pt-[env(safe-area-inset-top)]">
      {/* enlace accesible para saltar contenido */}
      <a href="#main" className="sr-only focus:not-sr-only absolute left-2 top-2 bg-white border px-3 py-1 rounded-md">
        Saltar al contenido
      </a>

      <nav className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 h-14 md:h-16 flex items-center justify-between">
        {/* Marca + selector */}
        <div className="flex items-center gap-3 min-w-0">
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
          <button onClick={goPreEval} className={cx(btn, isActive('pre') && 'bg-slate-100 border-slate-300')} title="Pre-evaluación">Pre-evaluación</button>
          <button onClick={goRuta} className={cx(btnPrimary, isActive('ruta') && 'ring-2 ring-slate-400')} title="Mi ruta">Mi ruta</button>
          <button onClick={goBuscar} className={cx(btn, isActive('buscar') && 'bg-slate-100 border-slate-300')} title="Explorar apuntes">Apuntes</button>
          {isAuthed ? (
            <button onClick={handleLogout} className="text-sm text-slate-500 hover:text-slate-900 ml-1" title="Cerrar sesión">
              Salir
            </button>
          ) : (
            <button onClick={goLogin} className="text-sm text-slate-500 hover:text-slate-900 ml-1">Entrar</button>
          )}
        </div>

        {/* Botón menú (mobile, pulido) */}
        <div className="md:hidden flex items-center gap-2">
          {isAuthed && (
            <Link
              to="/perfil"
              aria-label="Ir a mi perfil"
              className="inline-grid place-items-center h-9 w-9 rounded-full bg-slate-100 text-slate-700 text-sm font-semibold ring-1 ring-slate-200"
            >
              {(legacyUser?.nombre?.[0] || '👤')}
            </Link>
          )}
          <button
            aria-label="Abrir menú"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(o => !o)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/90 ring-1 ring-slate-200 shadow-sm hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 active:scale-95 transition"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-slate-800">
              <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </nav>

      {/* Panel móvil */}
      <div
        className={cx(
          "md:hidden transition-[max-height] overflow-hidden border-t bg-white shadow-md",
          mobileOpen ? "max-h-[80vh]" : "max-h-0"
        )}
      >
        <div className="max-w-7xl mx-auto px-3 py-3 space-y-3">
          {/* Selector móvil */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">Materia</label>
            <select
              value={subject}
              onChange={(e) => { setSubject(e.target.value); setMobileOpen(false); }}
              className="w-full rounded-md border bg-white px-3 py-2.5 text-[15px]"
              aria-label="Materia"
            >
              {SUBJECTS.map(s => (
                <option key={s.slug} value={s.slug}>{s.nombre}</option>
              ))}
            </select>
          </div>

          {/* Acciones */}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={goPreEval} className={cx("min-h-11 rounded-md border px-3 text-[15px]", isActive('pre') && "bg-slate-50 border-slate-300")}>
              Pre-evaluación
            </button>
            <button onClick={goRuta} className="min-h-11 rounded-md bg-slate-900 text-white px-3 text-[15px]">
              Mi ruta
            </button>
            <button onClick={goBuscar} className={cx("min-h-11 rounded-md border px-3 text-[15px] col-span-2", isActive('buscar') && "bg-slate-50 border-slate-300")}>
              Apuntes
            </button>
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
    </header>
  );
}

/* util seguro para JSON.parse */
function safeParse(str) {
  try { return JSON.parse(str || 'null'); } catch { return null; }
}
