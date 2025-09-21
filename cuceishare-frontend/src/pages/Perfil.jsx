// src/pages/Perfil.jsx
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const API =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3001';

export default function Perfil() {
  const navigate = useNavigate();

  const sesion = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('usuario')); } catch { return null; }
  }, []);
  const token = localStorage.getItem('token');
  const role = sesion?.tipo;                 // 'admin' | 'profesor' | 'estudiante'
  const username = sesion?.username || sesion?.id || sesion?.user || null;

  const [apuntes, setApuntes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  // Helper: intenta extraer arreglo desde distintas formas
  const normalizeArray = (data) => {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.apuntes)) return data.apuntes;
    if (data && Array.isArray(data.items)) return data.items;
    return []; // si no es arreglo, devolvemos vacío
  };

  useEffect(() => {
    if (!token) { setLoading(false); return; }

    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    fetch(`${API}/apuntes`, { headers })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg = json?.error || `HTTP ${res.status}`;
          throw new Error(msg);
        }
        const arr = normalizeArray(json);
        // si no eres admin, deja solo tus apuntes (ajusta el campo 'autor' a como lo guardas)
        const propios = role === 'admin' ? arr : arr.filter(a =>
          // intenta varios campos posibles de autoría
          a.autor === (sesion?.username || sesion?.tipo || username) ||
          a.user === (sesion?.username || sesion?.tipo || username) ||
          a.usuario === (sesion?.username || sesion?.tipo || username) ||
          a.usuario_id === sesion?.id
        );
        setApuntes(propios);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [API, token, role, username, sesion]);

  const handleDelete = async (id) => {
    if (!window.confirm('¿Seguro que quieres eliminar este apunte?')) return;

    try {
      const res = await fetch(`${API}/apuntes/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      setApuntes(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      alert(`No se pudo borrar: ${err.message}`);
    }
  };

  if (!token) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600">No has iniciado sesión.</p>
        <button
          onClick={() => navigate('/login')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
        >
          Ir al login
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">👤 Perfil de {sesion?.username || role}</h2>
        <div className="flex gap-2">
          <Link
            to="/subir"
            className="px-3 py-1 bg-indigo-600 text-white rounded"
          >
            ➕ Subir apunte
          </Link>
          <button
            onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('usuario'); navigate('/login'); }}
            className="px-3 py-1 bg-red-600 text-white rounded"
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      <h3 className="text-xl font-semibold mb-4">📚 Apuntes subidos</h3>

      {loading ? (
        <p>Cargando apuntes…</p>
      ) : error ? (
        <p className="text-red-600">Error: {error}</p>
      ) : apuntes.length === 0 ? (
        <p>No hay apuntes para mostrar.</p>
      ) : (
        <div className="space-y-4">
          {apuntes.map(a => (
            <div
              key={a.id}
              className="flex justify-between items-start bg-white p-4 rounded-lg shadow"
            >
              <div>
                <h4 className="font-semibold text-lg">{a.titulo || a.title || `Apunte #${a.id}`}</h4>
                <p className="text-gray-700">{a.descripcion || a.description}</p>
                <p className="text-gray-500 text-sm mt-1">
                  Autor: {a.autor || a.user || a.usuario || 'N/D'}
                </p>
              </div>
              <div className="flex flex-col space-y-2 ml-4">
                <Link
                  to={`/editar/${a.id}`}
                  className="text-blue-600 hover:underline"
                >
                  ✏️ Editar
                </Link>
                <button
                  onClick={() => handleDelete(a.id)}
                  className="text-red-600 hover:underline"
                >
                  🗑️ Borrar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
