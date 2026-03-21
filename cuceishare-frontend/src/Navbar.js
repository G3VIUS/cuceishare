// src/Navbar.js
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import logo from './logo.png'; // 👈 aquí va tu logo (copia LOGO TRANS.png como logo.png)

const SUBJECTS = [
  { slug: 'ed1', nombre: 'Estructuras de Datos I', routeSlug: 'ed1', preSlug: 'ed1' },
  { slug: 'aserv', nombre: 'Administración de Servidores', routeSlug: 'aserv', preSlug: 'aserv' },
  { slug: 'mineria-datos', nombre: 'Minería de Datos', routeSlug: 'mineria-datos', preSlug: 'mineria-datos' },
  { slug: 'redes', nombre: 'Redes', routeSlug: 'redes', preSlug: 'redes' },
  { slug: 'algoritmia', nombre: 'Algoritmia', routeSlug: 'algoritmia', preSlug: 'algoritmia' },
  { slug: 'programacion', nombre: 'Programación', routeSlug: 'programacion', preSlug: 'programacion' },
  { slug: 'ingsoft', nombre: 'Ingeniería de Software', routeSlug: 'ingsoft', preSlug: 'ingsoft' },
  { slug: 'seguridad', nombre: 'Seguridad de la Información', routeSlug: 'seginf', preSlug: 'seginf' },
  { slug: 'teoria', nombre: 'Teoría de la Computación', routeSlug: 'teoria', preSlug: 'teoria' },
];

const LS_SUBJECT = 'lastSubjectSlug';
const cx = (...xs) => xs.filter(Boolean).join(' ');
const safeParse = (str) => { try { return JSON.parse(str || 'null'); } catch { return null; } };
const isPath = (pathname, starts) => starts.some(s => pathname.startsWith(s));
const findSubjectByAny = (code) =>
  code ? SUBJECTS.find(s => [s.slug, s.routeSlug, s.preSlug].includes(code)) || null : null;

export default function Navbar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const token = localStorage.getItem('token');
  const legacyUser = safeParse(localStorage.getItem('usuario'));
  const isAuthed = Boolean(token);

  useEffect(() => {
    if (!token && legacyUser) localStorage.removeItem('usuario');
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const initialSubject = useMemo(() => {
    const parts = pathname.split('/').filter(Boolean);
    const codeFromUrl = ['pre-eval', 'ruta', 'content', 'practice'].includes(parts[0]) ? parts[1] : null;
    const fromUrl = findSubjectByAny(codeFromUrl)?.slug;
    const stored = localStorage.getItem(LS_SUBJECT);
    const fallback = SUBJECTS[0].slug;
    const candidate = fromUrl || stored || fallback;
    return SUBJECTS.some(s => s.slug === candidate) ? candidate : fallback;
  }, [pathname]);

  const [subject, setSubject] = useState(initialSubject);
  const current = SUBJECTS.find(s => s.slug === subject) ?? SUBJECTS[0];
  const rSlug = current.routeSlug || current.slug;
  const pSlug = current.preSlug || current.slug;

  useEffect(() => { localStorage.setItem(LS_SUBJECT, subject); }, [subject]);
  useEffect(() => {
    const parts = pathname.split('/').filter(Boolean);
    const codeFromUrl = ['pre-eval', 'ruta', 'content', 'practice'].includes(parts[0]) ? parts[1] : null;
    const found = findSubjectByAny(codeFromUrl);
    if (found && found.slug !== subject) setSubject(found.slug);
  }, [pathname, subject]);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  useEffect(() => { setMobileOpen(false); setUserOpen(false); }, [pathname]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && (setMobileOpen(false), setUserOpen(false));
    const onClick = (e) => {
      const dd = document.getElementById('user-dd');
      if (dd && !dd.contains(e.target)) setUserOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('click', onClick);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('click', onClick); };
  }, []);

  const go = (to) => () => { setMobileOpen(false); setUserOpen(false); navigate(to); };
  const goPreEval = go(`/pre-eval/${pSlug}`);
  const goRuta = go(`/ruta/${rSlug}`);
  const goBuscar = go(`/buscar?materia=${rSlug}`);

  const goSubir = () => { setMobileOpen(false); setUserOpen(false); navigate(isAuthed ? '/subir' : '/login'); };
  const goPerfil = () => { setMobileOpen(false); setUserOpen(false); navigate(isAuthed ? '/perfil' : '/login'); };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    SUBJECTS.forEach(s => {
      localStorage.removeItem(`${s.slug}:preeval:draft`);
      localStorage.removeItem(`${s.slug}:route:progress`);
    });
    setUserOpen(false);
    navigate('/login');
  };

  const btn = "px-3 h-11 md:h-9 inline-flex items-center justify-center rounded-lg border text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300";
  const cta = "px-3 h-11 md:h-9 inline-flex items-center justify-center rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400";
  const pill = "px-3 h-10 md:h-8 rounded-full border bg-white text-sm";

  const isPre = isPath(pathname, ['/pre-eval/']);
  const isRuta = isPath(pathname, ['/ruta/']);
  const isFind = isPath(pathname, ['/buscar']);

  return (
    <header className="sticky top-0 z-50 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/65 border-b pt-[env(safe-area-inset-top)]">
      <a href="#main" className="sr-only focus:not-sr-only absolute left-2 top-2 bg-white border px-3 py-1 rounded-md">
        Saltar al contenido
      </a>

      <nav className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 h-16 md:h-16 grid grid-cols-[auto_1fr_auto] items-center gap-3">
        {/* Marca + selector */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Logo + texto */}
          <Link to="/" className="relative flex items-center h-16 w-36">
            <img
              src={logo}
              alt="CUCEIShare"
              className="absolute top-1/2 -translate-y-1/2 h-28 w-auto shrink-0 z-10 max-w-none"
            />
          </Link>

          {/* Selector materia (md+) */}
          <div className="hidden md:flex items-center gap-2">
            <label htmlFor="nav-subject" className="sr-only">Materia</label>
            <select
              id="nav-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className={pill}
              title="Materia"
            >
              {SUBJECTS.map(s => (
                <option key={s.slug} value={s.slug}>{s.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Acciones centrales (md+) */}
        <div className="hidden md:flex items-center justify-center gap-2">
          <button onClick={goPreEval} className={cx(btn, isPre && "bg-slate-100 border-slate-300")} title="Pre-evaluación">
            Pre-evaluación
          </button>
          <button onClick={goRuta} className={cx(cta, isRuta && "ring-2 ring-slate-400")} title="Mi ruta">
            Mi ruta
          </button>
          <button onClick={goBuscar} className={cx(btn, isFind && "bg-slate-100 border-slate-300")} title="Explorar apuntes">
            Apuntes
          </button>
        </div>

        {/* Lado derecho */}
        <div className="flex items-center gap-2 justify-self-end">
          <button onClick={goSubir} className={cx("hidden md:inline-flex", btn)}>
            {isAuthed ? 'Subir' : 'Iniciar sesión'}
          </button>

          <button
            onClick={goPerfil}
            aria-label="Perfil"
            className="hidden md:inline-grid place-items-center h-9 w-9 rounded-full bg-slate-100 ring-1 ring-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            title={isAuthed ? 'Mi perfil' : 'Iniciar sesión'}
          >
            {isAuthed ? (legacyUser?.nombre?.[0] || '👤') : '👤'}
          </button>

          <button
            aria-label="Abrir menú"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(o => !o)}
            className="md:hidden inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/90 ring-1 ring-slate-200 shadow-sm hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 active:scale-95 transition"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-slate-800">
              <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </nav>

      {/* Menú móvil */}
      <div
        className={cx(
          "md:hidden transition-[max-height] duration-300 overflow-hidden border-t bg-white shadow",
          mobileOpen ? "max-h-[85vh]" : "max-h-0"
        )}
      >
        <div className="px-3 sm:px-4 py-3 space-y-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Materia</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border bg-white px-3 py-3 text-[15px]"
              aria-label="Materia"
            >
              {SUBJECTS.map(s => (<option key={s.slug} value={s.slug}>{s.nombre}</option>))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={goPreEval} className={cx("min-h-12 rounded-lg border px-3 text-[15px] font-medium", isPre && "bg-slate-50 border-slate-300")}>
              Pre-evaluación
            </button>
            <button onClick={goRuta} className="min-h-12 rounded-lg bg-slate-900 text-white px-3 text-[15px] font-semibold">
              Mi ruta
            </button>
            <button onClick={goBuscar} className={cx("min-h-12 rounded-lg border px-3 text-[15px] font-medium col-span-2", isFind && "bg-slate-50 border-slate-300")}>
              Apuntes
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={goSubir} className="rounded-lg border px-3 h-11 text-[15px] font-medium">
              {isAuthed ? 'Subir apunte' : 'Iniciar sesión'}
            </button>
            <button onClick={goPerfil} className="rounded-lg border px-3 h-11 text-[15px] font-medium">
              {isAuthed ? 'Mi perfil' : 'Ir a login'}
            </button>
          </div>

          {isAuthed ? (
            <div className="pt-1">
              <button onClick={handleLogout} className="text-sm text-rose-700">Cerrar sesión</button>
            </div>
          ) : (
            <div className="text-sm">
              <Link to="/register" onClick={() => setMobileOpen(false)} className="underline underline-offset-2">
                Crear cuenta
              </Link>
            </div>
          )}

          <div className="pb-[env(safe-area-inset-bottom)]" />
        </div>
      </div>
    </header>
  );
}
