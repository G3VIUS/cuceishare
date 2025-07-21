import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="text-xl font-bold text-purple-700 flex items-center gap-2">
          🎓 CUCEIShare
        </Link>

        {/* Botón hamburguesa (móvil) */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden text-2xl"
        >
          ☰
        </button>

        {/* Menú (escondido en móvil hasta que se abre) */}
        <div className={`flex-col md:flex-row md:flex space-y-2 md:space-y-0 md:space-x-6 font-medium 
          ${menuOpen ? 'flex' : 'hidden'} md:flex`}>
          <Link to="/" className="hover:text-purple-700">🏠 Inicio</Link>
          <Link to="/buscar" className="hover:text-purple-700">🔍 Buscar</Link>
          <Link to="/subir" className="hover:text-purple-700">📝 Subir Apunte</Link>
          <Link to="/perfil" className="hover:text-purple-700">👤 Perfil</Link>
        </div>
      </div>
    </nav>
  );
}
