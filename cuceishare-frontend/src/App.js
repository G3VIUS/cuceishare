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

// ED1 (compat)
import PreEvalED1 from './pages/PreEvalED1';
import RouteED1 from './pages/RouteED1';

// Genéricas por materia
import PreEvalGeneric from './pages/PreEvalGeneric';
import RouteGeneric from './pages/RouteGeneric';

// 📚 Guías y explicaciones
import ContentTopic from './pages/ContentTopic';
import ContentQuestion from './pages/ContentQuestion';

// ✏️ Editor de apunte
import EditApunte from './pages/EditApunte';

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

          {/* ✏️ Editar apunte (ruta oficial en singular) */}
          <Route
            path="/apunte/:id/editar"
            element={
              <ProtectedRoute>
                <EditApunte />
              </ProtectedRoute>
            }
          />
          {/* Compatibilidad con plural (por si hay enlaces viejos) */}
          <Route
            path="/apuntes/:id/editar"
            element={
              <ProtectedRoute>
                <EditApunte />
              </ProtectedRoute>
            }
          />

          {/* Aprendizaje: ED1 (legacy) */}
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

          {/* 🔥 Aprendizaje: Genérico por materia */}
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
                <RouteGeneric />
              </ProtectedRouteToken>
            }
          />

          {/* 📚 Guías y 💡 Explicaciones */}
          <Route
            path="/content/:subjectSlug/topic/:blockId"
            element={
              <ProtectedRouteToken>
                <ContentTopic />
              </ProtectedRouteToken>
            }
          />
          <Route
            path="/content/:subjectSlug/question/:questionId"
            element={
              <ProtectedRouteToken>
                <ContentQuestion />
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
