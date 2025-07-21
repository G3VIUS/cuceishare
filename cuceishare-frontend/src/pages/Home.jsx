import { Link } from 'react-router-dom';

const apuntes = [
  {
    id: 1,
    titulo: 'Álgebra Lineal - Unidad 1',
    descripcion: 'Resumen con fórmulas y ejercicios.',
    autor: 'Ana López',
  },
  {
    id: 2,
    titulo: 'Cálculo Diferencial - Límites',
    descripcion: 'Apunte con gráficos explicativos.',
    autor: 'Carlos Pérez',
  },
  {
    id: 3,
    titulo: 'Programación en C - Funciones',
    descripcion: 'Conceptos clave y ejemplos de funciones en C.',
    autor: 'Luis Gómez',
  },
];

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold text-purple-700 mb-4">
        🎓 Bienvenido a <span className="text-black">CUCEIShare</span>
      </h1>
      <p className="text-gray-700 mb-8">
        Comparte y descubre apuntes. Deja reseñas sobre tus profesores.
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
