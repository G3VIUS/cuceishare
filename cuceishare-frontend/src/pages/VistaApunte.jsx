import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';

export default function VistaApunte() {
  const { id } = useParams();
  const [apunte, setApunte] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    fetch(`http://localhost:3001/apuntes/${id}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => setApunte(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="p-4 text-center">Cargando apunte…</p>;
  if (error)   return <p className="p-4 text-red-600">Error: {error}</p>;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-2">📄 {apunte.titulo}</h2>
      <p className="text-gray-600 mb-4"><strong>Autor:</strong> {apunte.autor}</p>
      <p className="mb-6">{apunte.descripcion}</p>
      <Link to="/" className="text-blue-600 hover:underline">← Volver al inicio</Link>
    </div>
  );
}
