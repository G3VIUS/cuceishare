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

// Proceso de aprendizaje
import PreEvalED1 from './pages/PreEvalED1';        // ← corregido
import RouteED1 from './pages/RouteED1';
import PreEvalGeneric from './pages/PreEvalGeneric'; // ← nuevo

// ---- Protecciones ----
function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token');
  const legacyUser = localStorage.getItem('usuario');
  return (token || legacyUser) ? children : <Navigate to="/login" replace />;
}

function ProtectedRouteToken({ children }) {
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
          {/* ED1 específico (backward compatible) */}
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

          {/* 🔥 Genérico para cualquier materia por slug */}
          <Route
            path="/pre-eval/:subjectSlug"
            element={
              <ProtectedRouteToken>
                <PreEvalGeneric />
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
