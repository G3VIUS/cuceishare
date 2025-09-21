import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function EditApunte() {
  const { id } = useParams();
  const navigate = useNavigate();
  const usuario = JSON.parse(localStorage.getItem('usuario'))?.tipo;

  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    // Trae el apunte existente
    fetch(`http://localhost:3001/apuntes/${id}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        setTitulo(data.titulo);
        setDescripcion(data.descripcion);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch(`http://localhost:3001/apuntes/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user': usuario,
        },
        body: JSON.stringify({ titulo, descripcion }),
      });
      const body = await res.json();

      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);

      navigate('/perfil');
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <p className="p-4 text-center">Cargando apunte…</p>;

  return (
    <div className="max-w-xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">✏️ Editar Apunte</h2>
      {error && <p className="text-red-600 mb-4">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1 font-semibold">Título</label>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="w-full border border-gray-300 rounded p-2"
          />
        </div>
        <div>
          <label className="block mb-1 font-semibold">Descripción</label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="w-full border border-gray-300 rounded p-2"
            rows="4"
          />
        </div>
        <button
          type="submit"
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
        >
          Guardar cambios
        </button>
      </form>
    </div>
  );
}
