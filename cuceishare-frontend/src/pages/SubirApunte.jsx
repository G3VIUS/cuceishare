// src/pages/SubirApunte.jsx
import { useState } from 'react';

export default function SubirApunte() {
  // Tomamos el usuario logueado desde localStorage
  const usuario = JSON.parse(localStorage.getItem('usuario'))?.tipo;

  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMensaje('');

    if (!titulo.trim() || !descripcion.trim()) {
      setError('❗ Todos los campos son obligatorios.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('http://localhost:3001/apuntes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo,
          descripcion,
          autor: usuario,    // usamos el usuario de la sesión
        }),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      setMensaje(`✅ Apunte "${body.titulo}" creado con ID ${body.id}!`);
      setTitulo('');
      setDescripcion('');
    } catch (err) {
      setError(`❌ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">📤 Subir nuevo apunte</h2>

      {mensaje && (
        <div className="mb-4 p-2 bg-green-100 text-green-800 rounded">
          {mensaje}
        </div>
      )}
      {error && (
        <div className="mb-4 p-2 bg-red-100 text-red-800 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1 font-semibold">Título</label>
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="w-full border border-gray-300 rounded-md p-2"
            placeholder="Ej. Álgebra - Unidad 1"
          />
        </div>

        <div>
          <label className="block mb-1 font-semibold">Descripción</label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="w-full border border-gray-300 rounded-md p-2"
            rows="4"
            placeholder="Resumen con fórmulas y ejercicios…"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full text-white py-2 rounded-md transition ${
            loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {loading ? 'Subiendo…' : 'Subir apunte'}
        </button>
      </form>
    </div>
  );
}
