import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function Home() {
  const [apuntes, setApuntes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Llama a tu API Express local
    fetch('http://localhost:3001/apuntes')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => setApuntes(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="p-4 text-center">Cargando apuntes…</p>;
  if (error)   return <p className="p-4 text-red-600">Error: {error}</p>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold text-purple-700 mb-4">
        🎓 Bienvenido a <span className="text-black">CUCEIShare</span>
      </h1>
      <p className="text-gray-700 mb-8">
        Comparte y descubre apuntes reales almacenados en tu base de datos.
      </p>

      <h3 className="text-2xl font-semibold text-gray-800 mb-4">📚 Apuntes recientes:</h3>

      <div className="space-y-4">
        {apuntes.map((apunte) => (
          <div
            key={apunte.id}
            className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow"
          >
            <h4 className="text-xl font-bold text-gray-800">{apunte.titulo}</h4>
            <p className="text-gray-600">{apunte.descripcion}</p>
            <p className="text-sm text-gray-500 mt-1">
              <strong>Autor:</strong> {apunte.autor}
            </p>
            <Link
              to={`/apunte/${apunte.id}`}
              className="inline-block mt-3 text-sm text-blue-600 hover:underline font-medium"
            >
              Ver apunte →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
