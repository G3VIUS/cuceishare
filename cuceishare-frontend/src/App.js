// src/App.js
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Layout
import Navbar from './Navbar';

// Páginas
import Home from './pages/Home';
import Buscar from './pages/Buscar';
import SubirApunte from './pages/SubirApunte';
import VistaApunte from './pages/VistaApunte';
import Login from './pages/Login';
import Register from './pages/Register';
import Perfil from './pages/Perfil';

// Proceso de aprendizaje (Estructuras de Datos I)
import PreEvalED1 from './pages/PreEvalED1';
import RouteED1 from './pages/RouteED1';

// ---- Protecciones ----
function ProtectedRoute({ children }) {
  // Compatibilidad: deja pasar si hay token O la sesión antigua 'usuario'
  const token = localStorage.getItem('token');
  const legacyUser = localStorage.getItem('usuario');
  return (token || legacyUser) ? children : <Navigate to="/login" replace />;
}

function ProtectedRouteToken({ children }) {
  // Estricto: SOLO si hay token JWT válido en el storage
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Router>
      <Navbar />
      <div className="p-4">
        <Routes>
          {/* Públicas */}
          <Route path="/" element={<Home />} />
          <Route path="/buscar" element={<Buscar />} />
          <Route path="/apunte/:id" element={<VistaApunte />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protegidas (compatibilidad) */}
          <Route
            path="/subir"
            element={
              <ProtectedRoute>
                <SubirApunte />
              </ProtectedRoute>
            }
          />
          <Route
            path="/perfil"
            element={
              <ProtectedRoute>
                <Perfil />
              </ProtectedRoute>
            }
          />

          {/* Aprendizaje (requiere JWT) */}
          <Route
            path="/pre-eval/ed1"
            element={
              <ProtectedRouteToken>
                <PreEvalED1 />
              </ProtectedRouteToken>
            }
          />
          <Route
            path="/ruta/ed1"
            element={
              <ProtectedRouteToken>
                <RouteED1 />
              </ProtectedRouteToken>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}
