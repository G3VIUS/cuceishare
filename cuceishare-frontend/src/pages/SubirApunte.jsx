import { useState } from 'react';

export default function SubirApunte() {
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [autor, setAutor] = useState('');
  const [imagen, setImagen] = useState(null);
  const [previewURL, setPreviewURL] = useState(null);
  const [subido, setSubido] = useState(false);

  const handleImagenChange = (e) => {
    const file = e.target.files[0];
    setImagen(file);
    setPreviewURL(URL.createObjectURL(file));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!titulo || !descripcion || !autor || !imagen) {
      alert('Por favor completa todos los campos');
      return;
    }

    console.log('Apunte simulado:', { titulo, descripcion, autor, imagen });
    setSubido(true);
    setTitulo('');
    setDescripcion('');
    setAutor('');
    setImagen(null);
    setPreviewURL(null);
  };

  return (
    <div style={{ maxWidth: 500, margin: '40px auto', padding: 30, backgroundColor: '#f4f9ff', borderRadius: 12, boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
      <h2 style={{ marginBottom: 20 }}>📚 Subir nuevo apunte</h2>

      {subido && <p style={{ color: 'green', marginBottom: 15 }}>✅ ¡Apunte subido exitosamente!</p>}

      <form onSubmit={handleSubmit}>
        <label style={{ fontWeight: 'bold' }}>Título:</label><br />
        <input
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', marginBottom: 15 }}
        /><br />

        <label style={{ fontWeight: 'bold' }}>Descripción:</label><br />
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows="3"
          style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', marginBottom: 15 }}
        ></textarea><br />

        <label style={{ fontWeight: 'bold' }}>Autor:</label><br />
        <input
          type="text"
          value={autor}
          onChange={(e) => setAutor(e.target.value)}
          style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', marginBottom: 15 }}
        /><br />

        <label style={{ fontWeight: 'bold' }}>Imagen del apunte:</label><br />
        <input type="file" accept="image/*" onChange={handleImagenChange} style={{ marginBottom: 20 }} /><br />

        {previewURL && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontWeight: 'bold' }}>Vista previa:</p>
            <img src={previewURL} alt="Vista previa" style={{ width: '100%', borderRadius: 10, border: '1px solid #ccc' }} />
          </div>
        )}

        <button type="submit" style={{ padding: '10px 20px', backgroundColor: '#4caf50', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
          📤 Subir apunte
        </button>
      </form>
    </div>
  );
}
