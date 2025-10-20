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

// Minería de Datos
import PreEvalMineriaDatos from './pages/PreEvalMineriaDatos';
import RouteMineriaDatos from './pages/RouteMineriaDatos';

// Redes
import PreEvalRedes from './pages/PreEvalRedes';
import RouteRedes from './pages/RouteRedes';

// Algoritmia
import PreEvalAlgoritmia from './pages/PreEvalAlgoritmia';
import RouteAlgoritmia from './pages/RouteAlgoritmia';

// Teoría de la Computación
import PreEvalTeoria from './pages/PreEvalTeoria';
import RouteTeoria from './pages/RouteTeoria';

// Programación
import PreEvalProgramacion from './pages/PreEvalProgramacion';
import RouteProgramacion from './pages/RouteProgramacion';

// Ingeniería de Software
import PreEvalIngSoftware from './pages/PreEvalIngSoftware';
import RouteIngSoftware from './pages/RouteIngSoftware';

// Seguridad de la Información (NUEVA)
import PreEvalSegInfo from './pages/PreEvalSegInfo';
import RouteSegInfo from './pages/RouteSegInfo';

// ---- Protecciones ----
function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token');
  const legacyUser = localStorage.getItem('usuario'); // compatibilidad
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

          {/* Protegidas (subir/perfil) */}
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
          {/* Compat con plural */}
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

          {/* Administración de Servidores */}
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

          {/* Minería de Datos */}
          <Route
            path="/pre-eval/mineria-datos"
            element={
              <ProtectedRouteToken>
                <PreEvalMineriaDatos />
              </ProtectedRouteToken>
            }
          />
          <Route
            path="/ruta/mineria-datos"
            element={
              <ProtectedRouteToken>
                <RouteMineriaDatos />
              </ProtectedRouteToken>
            }
          />

          {/* Redes */}
          <Route
            path="/pre-eval/redes"
            element={
              <ProtectedRouteToken>
                <PreEvalRedes />
              </ProtectedRouteToken>
            }
          />
          <Route
            path="/ruta/redes"
            element={
              <ProtectedRouteToken>
                <RouteRedes />
              </ProtectedRouteToken>
            }
          />

          {/* Algoritmia */}
          <Route
            path="/pre-eval/algoritmia"
            element={
              <ProtectedRouteToken>
                <PreEvalAlgoritmia />
              </ProtectedRouteToken>
            }
          />
          <Route
            path="/ruta/algoritmia"
            element={
              <ProtectedRouteToken>
                <RouteAlgoritmia />
              </ProtectedRouteToken>
            }
          />

          {/* Teoría de la Computación */}
          <Route
            path="/pre-eval/teoria"
            element={
              <ProtectedRouteToken>
                <PreEvalTeoria />
              </ProtectedRouteToken>
            }
          />
          <Route
            path="/ruta/teoria"
            element={
              <ProtectedRouteToken>
                <RouteTeoria />
              </ProtectedRouteToken>
            }
          />

          {/* Programación */}
          <Route
            path="/pre-eval/programacion"
            element={
              <ProtectedRouteToken>
                <PreEvalProgramacion />
              </ProtectedRouteToken>
            }
          />
          <Route
            path="/ruta/programacion"
            element={
              <ProtectedRouteToken>
                <RouteProgramacion />
              </ProtectedRouteToken>
            }
          />

          {/* Ingeniería de Software */}
          <Route
            path="/pre-eval/ingsoft"
            element={
              <ProtectedRouteToken>
                <PreEvalIngSoftware />
              </ProtectedRouteToken>
            }
          />
          <Route
            path="/ruta/ingsoft"
            element={
              <ProtectedRouteToken>
                <RouteIngSoftware />
              </ProtectedRouteToken>
            }
          />

          {/* Seguridad de la Información (principal: seginf) */}
          <Route
            path="/pre-eval/seginf"
            element={
              <ProtectedRouteToken>
                <PreEvalSegInfo />
              </ProtectedRouteToken>
            }
          />
          <Route
            path="/ruta/seginf"
            element={
              <ProtectedRouteToken>
                <RouteSegInfo />
              </ProtectedRouteToken>
            }
          />

          {/* Alias para compatibilidad con /seguridad */}
          <Route
            path="/pre-eval/seguridad"
            element={
              <ProtectedRouteToken>
                <PreEvalSegInfo />
              </ProtectedRouteToken>
            }
          />
          <Route
            path="/ruta/seguridad"
            element={
              <ProtectedRouteToken>
                <RouteSegInfo />
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
