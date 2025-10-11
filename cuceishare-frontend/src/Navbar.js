// src/Navbar.jsx
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

const SUBJECTS = [
  { slug: 'ed1', nombre: 'Estructuras de Datos I' },
  { slug: 'administracion-servidores', nombre: 'Administración de Servidores' },
  { slug: 'mineria-datos', nombre: 'Minería de Datos' },
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

  // persiste selección
  useEffect(() => {
    localStorage.setItem(LS_SUBJECT, subject);
  }, [subject]);

  // sincroniza si entras directo a otra materia por URL
  useEffect(() => {
    const parts = pathname.split('/').filter(Boolean);
    const slugFromUrl =
      ['pre-eval', 'ruta', 'content', 'practice'].includes(parts[0]) ? parts[1] : null;
    if (slugFromUrl && SUBJECTS.some(s => s.slug === slugFromUrl) && slugFromUrl !== subject) {
      setSubject(slugFromUrl);
    }
  }, [pathname, subject]);

  const current = SUBJECTS.find(s => s.slug === subject) ?? SUBJECTS[0];

  const goPreEval = () => navigate(`/pre-eval/${current.slug}`);
  const goRuta    = () => navigate(`/ruta/${current.slug}`);
  const goBuscar  = () => navigate(`/buscar?materia=${current.slug}`);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    SUBJECTS.forEach(s => {
      localStorage.removeItem(`${s.slug}:preeval:draft`);
      localStorage.removeItem(`${s.slug}:route:progress`);
    });
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-white/70 bg-white/90 border-b">
      <nav className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* marca */}
        <Link to="/" className="text-[15px] font-semibold tracking-tight text-slate-900">
          CUCEIShare
        </Link>

        {/* selector de materia */}
        {SUBJECTS.length > 0 && (
          <div className="flex items-center gap-2">
            <label htmlFor="subject" className="sr-only">Materia</label>
            <select
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="text-sm border rounded-md px-2 py-1 bg-white"
            >
              {SUBJECTS.map(s => (
                <option key={s.slug} value={s.slug}>{s.nombre}</option>
              ))}
            </select>
          </div>
        )}

        {/* acciones */}
        <div className="flex items-center gap-2">
          <button
            onClick={goPreEval}
            className="text-sm px-3 py-1.5 rounded-md border hover:bg-slate-50"
            title="Pre-evaluación"
          >
            Pre-evaluación
          </button>
          <button
            onClick={goRuta}
            className="text-sm px-3 py-1.5 rounded-md bg-slate-900 text-white hover:bg-black"
            title="Mi ruta"
          >
            Mi ruta
          </button>
          <button
            onClick={goBuscar}
            className="text-sm px-3 py-1.5 rounded-md border hover:bg-slate-50"
            title="Explorar apuntes"
          >
            Apuntes
          </button>

          {/* sesión */}
          {isAuthed ? (
            <button
              onClick={handleLogout}
              className="text-sm text-slate-500 hover:text-slate-900 ml-1"
              title="Cerrar sesión"
            >
              Salir
            </button>
          ) : (
            <Link to="/login" className="text-sm text-slate-500 hover:text-slate-900 ml-1">
              Entrar
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
