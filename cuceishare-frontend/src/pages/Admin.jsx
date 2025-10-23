// src/pages/Admin.jsx
import { Navigate } from 'react-router-dom';

export default function Admin() {
  // Redirige al panel por defecto (apuntes)
  return <Navigate to="/admin/apuntes" replace />;
}
