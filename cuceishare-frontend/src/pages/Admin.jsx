import { useState, useEffect } from 'react';

export default function Admin() {
  const [apuntes, setApuntes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const usuario = JSON.parse(localStorage.getItem('usuario'))?.tipo || null;

  useEffect(() => {
    // Carga TODOS los apuntes
    fetch('http://localhost:3001/apuntes')
      .then(res => res.json())
      .then(setApuntes)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar definitivamente este apunte?')) return;

    try {
      const res = await fetch(`http://localhost:3001/apuntes/${id}`, {
        method: 'DELETE',
        headers: { 'x-user': usuario }
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      // Refresca la lista local
      setApuntes(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      alert(`Error al borrar: ${err.message}`);
    }
  };

  if (!usuario) return null; // por si acaso
  if (usuario !== 'admin') return null; // solo admin

  if (loading) return <p className="p-4">Cargando apuntes…</p>;
  if (error)   return <p className="p-4 text-red-600">Error: {error}</p>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">⚙️ Panel de administración</h2>
      {apuntes.map(a => (
        <div
          key={a.id}
          className="flex justify-between items-center bg-white p-4 rounded shadow mb-3"
        >
          <div>
            <h4 className="font-semibold">{a.titulo}</h4>
            <p className="text-sm text-gray-600">Autor: {a.autor}</p>
          </div>
          <button
            onClick={() => handleDelete(a.id)}
            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
          >
            🗑️ Borrar
          </button>
        </div>
      ))}
    </div>
  );
}
