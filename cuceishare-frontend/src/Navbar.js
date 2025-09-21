// src/Navbar.jsx
import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Sesión: preferimos token; dejamos compat con `usuario`
  const token = localStorage.getItem('token');
  const legacyUser = localStorage.getItem('usuario');
  const isAuthed = !!token || !!legacyUser;

  const isAuthPage = pathname === '/login' || pathname === '/register';

  const handleLogout = () => {
    // limpia todo lo relacionado a sesión y borradores
    localStorage.removeItem('token');                // JWT
    localStorage.removeItem('usuario');              // sesión legacy
    localStorage.removeItem('ed1:preeval:draft');    // borrador pre-eval
    localStorage.removeItem('ed1:route:progress');   // progreso ruta
    navigate('/login');
  };

  const linkBase = 'hover:text-purple-700 transition-colors';
  const active = 'text-purple-700 font-semibold';

  return (
    <nav className="bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="text-xl font-bold text-purple-700 flex items-center gap-2">
          🎓 CUCEIShare
        </Link>

        {/* Hamburguesa (móvil) */}
        <button
          onClick={() => setMenuOpen(o => !o)}
          className="md:hidden text-2xl"
          aria-label="Abrir menú"
        >
          ☰
        </button>

        {/* Menú */}
        <div
          className={`flex-col md:flex-row md:flex space-y-2 md:space-y-0 md:space-x-6 font-medium 
            ${menuOpen ? 'flex' : 'hidden'} md:flex`}
        >
          {/* ---- Sin sesión ---- */}
          {!isAuthed && (
            <>
              {isAuthPage ? (
                <>
                  {pathname === '/login' && (
                    <Link to="/register" className={linkBase}>🆕 Registro</Link>
                  )}
                  {pathname === '/register' && (
                    <Link to="/login" className={linkBase}>🔑 Login</Link>
                  )}
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

              {/* Accesos al flujo de aprendizaje (requiere token real) */}
              <Link to="/pre-eval/ed1" className={`${linkBase} ${pathname==='/pre-eval/ed1'?active:''}`}>
                📊 Pre-evaluación
              </Link>
              <Link to="/ruta/ed1" className={`${linkBase} ${pathname==='/ruta/ed1'?active:''}`}>
                🗺️ Mi ruta
              </Link>

              <button onClick={handleLogout} className="hover:text-red-600 font-semibold">
                🚪 Cerrar sesión
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
