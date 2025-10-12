// src/App.js
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Layout
import Navbar from './Navbar';

// Páginas base
import Home from './pages/Home';
import Buscar from './pages/Buscar';
import SubirApunte from './pages/SubirApunte';
import VistaApunte from './pages/VistaApunte';
import Login from './pages/Login';
import Register from './pages/Register';
import Perfil from './pages/Perfil';

// ✏️ Editor de apunte
import EditApunte from './pages/EditApunte';

// ===== Materias con archivos individuales =====
// ED1
import PreEvalED1 from './pages/PreEvalED1';
import RouteED1 from './pages/RouteED1';

// Administración de Servidores (ASERV)
import PreEvalAdminServ from './pages/PreEvalAdminServ';
import RouteAdminServ from './pages/RouteAdminServ';

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

          {/* Protegidas */}
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

          {/* ✏️ Editar apunte */}
          <Route
            path="/apunte/:id/editar"
            element={
              <ProtectedRoute>
                <EditApunte />
              </ProtectedRoute>
            }
          />
          {/* Compat plural (enlaces viejos) */}
          <Route
            path="/apuntes/:id/editar"
            element={
              <ProtectedRoute>
                <EditApunte />
              </ProtectedRoute>
            }
          />

          {/* ===== Aprendizaje por materia ===== */}
          {/* ED1 */}
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

          {/* Administración de Servidores (ASERV) */}
          <Route
            path="/pre-eval/aserv"
            element={
              <ProtectedRouteToken>
                <PreEvalAdminServ />
              </ProtectedRouteToken>
            }
          />
          <Route
            path="/ruta/aserv"
            element={
              <ProtectedRouteToken>
                <RouteAdminServ />
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
