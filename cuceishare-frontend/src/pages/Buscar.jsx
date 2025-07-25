import { useState, useEffect } from 'react';

export default function Buscar() {
  const [apuntes, setApuntes] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    fetch('http://localhost:3001/apuntes')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => setApuntes(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const resultados = apuntes.filter((a) =>
    a.titulo.toLowerCase().includes(filtro.toLowerCase()) ||
    a.autor.toLowerCase().includes(filtro.toLowerCase())
  );

  if (loading) return <p className="p-4">Cargando…</p>;
  if (error)   return <p className="p-4 text-red-600">Error: {error}</p>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">🔍 Buscar apuntes</h2>
      <input
        type="text"
        placeholder="Busca por título o autor..."
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        className="w-full border border-gray-300 rounded-md p-2 mb-6"
      />

      {resultados.length > 0 ? (
        resultados.map((a) => (
          <div
            key={a.id}
            className="bg-white p-4 rounded-md shadow mb-4"
          >
            <h3 className="font-semibold text-lg">{a.titulo}</h3>
            <p className="text-sm text-gray-600">Autor: {a.autor}</p>
          </div>
        ))
      ) : (
        <p className="text-gray-500">No se encontraron apuntes.</p>
      )}
    </div>
  );
}
