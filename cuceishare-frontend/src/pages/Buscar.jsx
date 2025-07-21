import { useState } from 'react';

const apuntesSimulados = [
  {
    id: 1,
    titulo: 'Álgebra Lineal - Unidad 1',
    descripcion: 'Resumen con fórmulas y ejercicios.',
    materia: 'Álgebra Lineal',
    semestre: '1',
  },
  {
    id: 2,
    titulo: 'Cálculo Diferencial - Derivadas',
    descripcion: 'Guía completa para derivar funciones.',
    materia: 'Cálculo Diferencial',
    semestre: '2',
  },
  {
    id: 3,
    titulo: 'POO - Clases y Objetos',
    descripcion: 'Explicación clara con ejemplos en Java.',
    materia: 'Programación Orientada a Objetos',
    semestre: '3',
  },
];

export default function Buscar() {
  const [materia, setMateria] = useState('');
  const [semestre, setSemestre] = useState('');

  const filtrados = apuntesSimulados.filter((a) => {
    return (
      (materia === '' || a.materia === materia) &&
      (semestre === '' || a.semestre === semestre)
    );
  });

  const materiasUnicas = [...new Set(apuntesSimulados.map(a => a.materia))];
  const semestresUnicos = [...new Set(apuntesSimulados.map(a => a.semestre))];

  return (
    <div style={{ maxWidth: 800, margin: 'auto', padding: 20 }}>
      <h2>🔍 Buscar apuntes</h2>

      <div style={{ marginBottom: 20 }}>
        <label><strong>Filtrar por materia:</strong> </label>
        <select value={materia} onChange={(e) => setMateria(e.target.value)}>
          <option value="">Todas</option>
          {materiasUnicas.map((m, idx) => (
            <option key={idx} value={m}>{m}</option>
          ))}
        </select>

        <label style={{ marginLeft: 20 }}><strong>Filtrar por semestre:</strong> </label>
        <select value={semestre} onChange={(e) => setSemestre(e.target.value)}>
          <option value="">Todos</option>
          {semestresUnicos.map((s, idx) => (
            <option key={idx} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {filtrados.length === 0 ? (
        <p>No se encontraron apuntes con esos filtros.</p>
      ) : (
        filtrados.map((apunte) => (
          <div key={apunte.id} style={{
            background: '#f3f3f3',
            padding: 15,
            marginBottom: 15,
            borderRadius: 8,
            boxShadow: '0 1px 4px rgba(0,0,0,0.1)'
          }}>
            <h4>{apunte.titulo}</h4>
            <p><strong>Descripción:</strong> {apunte.descripcion}</p>
            <p><strong>Materia:</strong> {apunte.materia}</p>
            <p><strong>Semestre:</strong> {apunte.semestre}</p>
          </div>
        ))
      )}
    </div>
  );
}
