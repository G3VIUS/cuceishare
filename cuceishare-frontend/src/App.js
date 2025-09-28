import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Layout
import Navbar from './Navbar';

// Páginas generales
import Home from './pages/Home';
import Buscar from './pages/Buscar';
import SubirApunte from './pages/SubirApunte';
import VistaApunte from './pages/VistaApunte';
import Login from './pages/Login';
import Register from './pages/Register';
import Perfil from './pages/Perfil';

// Aprendizaje (legacy ED1 + genérico por materia)
import PreEvalED1 from './pages/PreEvalED1';       // legado / compatibilidad
import RouteED1 from './pages/RouteED1';           // legado / compatibilidad
import PreEvalGeneric from './pages/PreEvalGeneric';
import RouteSubject from './pages/RouteSubject';

// ---- Protecciones ----
function ProtectedRoute({ children }) {
  // Compatibilidad: deja pasar si hay token O la sesión antigua 'usuario'
  const token = localStorage.getItem('token');
  const legacyUser = localStorage.getItem('usuario');
  return (token || legacyUser) ? children : <Navigate to="/login" replace />;
}

function ProtectedRouteToken({ children }) {
  // Estricto: SOLO si hay token JWT en el storage
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
          {/* Legacy ED1 */}
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

          {/* Genéricos por slug */}
          <Route
            path="/pre-eval/:subjectSlug"
            element={
              <ProtectedRouteToken>
                <PreEvalGeneric />
              </ProtectedRouteToken>
            }
          />
          <Route
            path="/ruta/:subjectSlug"
            element={
              <ProtectedRouteToken>
                <RouteSubject />
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
