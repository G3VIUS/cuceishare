import { useParams, Link } from 'react-router-dom';

const apuntes = [
  {
    id: 1,
    titulo: 'Álgebra Lineal - Unidad 1',
    descripcion: 'Resumen con fórmulas y ejercicios.',
    autor: 'Ana López',
    imagen: 'https://via.placeholder.com/600x400',
  },
  {
    id: 2,
    titulo: 'Cálculo Diferencial - Límites',
    descripcion: 'Apunte con gráficos explicativos.',
    autor: 'Carlos Pérez',
    imagen: 'https://via.placeholder.com/600x400',
  },
  {
    id: 3,
    titulo: 'Programación en C - Funciones',
    descripcion: 'Conceptos clave y ejemplos de funciones en C.',
    autor: 'Luis Gómez',
    imagen: 'https://via.placeholder.com/600x400',
  },
];

export default function VistaApunte() {
  const { id } = useParams();
  const apunte = apuntes.find((a) => a.id === parseInt(id));

  if (!apunte) return <p>Apunte no encontrado</p>;

  return (
    <div style={{ maxWidth: 800, margin: 'auto' }}>
      <h2>📄 {apunte.titulo}</h2>
      <p><strong>Autor:</strong> {apunte.autor}</p>
      <img
        src={apunte.imagen}
        alt="Vista del apunte"
        style={{ width: '100%', marginBottom: 20 }}
      />
      <p>{apunte.descripcion}</p>

      <div style={{ marginTop: 20 }}>
        <button
          onClick={() => alert('Simulando descarga 📥')}
          style={{ marginRight: 10 }}
        >
          Descargar
        </button>
        <Link to="/">Volver al inicio</Link>
      </div>
    </div>
  );
}
