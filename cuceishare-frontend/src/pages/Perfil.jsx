export default function Perfil() {
  // Simulación de datos
  const usuario = {
    nombre: "Diego González",
    correo: "diego@cucei.udg.mx",
    carrera: "Ing. Computación",
    apuntesSubidos: 3,
    reseñas: 2,
  };

  const apuntes = [
    {
      id: 1,
      titulo: "Álgebra Lineal - Unidad 1",
      descripcion: "Resumen completo con fórmulas y ejercicios.",
    },
    {
      id: 2,
      titulo: "Cálculo Integral - Teorema Fundamental",
      descripcion: "Explicación con gráficas y ejemplos.",
    },
    {
      id: 3,
      titulo: "Bases de Datos - Modelo Relacional",
      descripcion: "Apuntes sobre relaciones, claves primarias y foráneas.",
    },
  ];

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Info usuario */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-2xl font-bold mb-2">👤 {usuario.nombre}</h2>
        <p className="text-gray-600">{usuario.correo}</p>
        <p className="text-gray-600">{usuario.carrera}</p>
      </div>

      {/* Estadísticas */}
      <div className="flex gap-4 mb-6">
        <div className="bg-purple-100 text-purple-800 p-4 rounded-lg w-full text-center">
          <p className="text-lg font-semibold">{usuario.apuntesSubidos}</p>
          <p>Apuntes subidos</p>
        </div>
        <div className="bg-pink-100 text-pink-800 p-4 rounded-lg w-full text-center">
          <p className="text-lg font-semibold">{usuario.reseñas}</p>
          <p>Reseñas</p>
        </div>
      </div>

      {/* Lista de apuntes */}
      <h3 className="text-xl font-bold mb-3">📚 Tus apuntes subidos</h3>
      <div className="space-y-4">
        {apuntes.map((a) => (
          <div key={a.id} className="border p-4 rounded-lg bg-white shadow-sm">
            <h4 className="font-semibold text-lg">{a.titulo}</h4>
            <p className="text-gray-700">{a.descripcion}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
