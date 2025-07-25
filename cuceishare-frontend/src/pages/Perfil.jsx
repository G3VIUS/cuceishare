// src/pages/Perfil.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Perfil() {
  const navigate = useNavigate();
  const sesion = JSON.parse(localStorage.getItem('usuario'));
  const usuario = sesion?.tipo;  // asumiendo que 'tipo' es tu nombre único

  const [apuntes, setApuntes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!usuario) return;
    fetch('http://localhost:3001/apuntes')
      .then((res) => res.json())
      .then((data) => {
        // Muestra solo los apuntes de este usuario
        setApuntes(data.filter((a) => a.autor === usuario));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [usuario]);

  const handleDelete = async (id) => {
    if (!window.confirm('¿Seguro que quieres eliminar este apunte?')) return;

    try {
      const res = await fetch(`http://localhost:3001/apuntes/${id}`, {
        method: 'DELETE',
        headers: { 'x-user': usuario },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Error al borrar');
      // Actualiza la lista local
      setApuntes((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      alert(`No se pudo borrar: ${err.message}`);
    }
  };

  if (!usuario) {
    return (
      <p className="p-4 text-red-600">
        No has iniciado sesión. <a href="/login" className="underline">Ir al login</a>
      </p>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">👤 Perfil de {usuario}</h2>
      </div>

      <h3 className="text-xl font-semibold mb-4">📚 Apuntes subidos</h3>
      {loading ? (
        <p>Cargando apuntes…</p>
      ) : error ? (
        <p className="text-red-600">Error: {error}</p>
      ) : apuntes.length === 0 ? (
        <p>No has subido apuntes aún.</p>
      ) : (
        apuntes.map((a) => (
          <div
            key={a.id}
            className="flex justify-between items-start bg-white p-4 rounded-lg shadow mb-4"
          >
            <div>
              <h4 className="font-semibold text-lg">{a.titulo}</h4>
              <p className="text-gray-700">{a.descripcion}</p>
            </div>
            <button
              onClick={() => handleDelete(a.id)}
              className="text-red-600 hover:text-red-800"
            >
              🗑️
            </button>
          </div>
        ))
      )}
    </div>
  );
}
