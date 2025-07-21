import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Páginas
import Home from './pages/Home';
import Buscar from './pages/Buscar';
import SubirApunte from './pages/SubirApunte';
import Perfil from './pages/Perfil';
import VistaApunte from './pages/VistaApunte';

// Navbar
import Navbar from './Navbar';

function App() {
  return (
    <Router>
      <Navbar />

      <div style={{ padding: '20px' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/buscar" element={<Buscar />} />
          <Route path="/subir" element={<SubirApunte />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/apunte/:id" element={<VistaApunte />} />
          </Routes>
      </div>
    </Router>
  );
}

export default App;
