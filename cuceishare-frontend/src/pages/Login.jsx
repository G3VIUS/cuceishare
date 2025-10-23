// src/pages/Login.jsx
import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';

const API =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3001';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextParam = searchParams.get('next') || '';

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } = await axios.post(`${API}/auth/login`, { username, password });

      const roleRaw = data?.user?.role ?? '';
      const role    = String(roleRaw).toLowerCase();

      localStorage.setItem('token', data.token);
      localStorage.setItem('usuario', JSON.stringify({
        id: data.user.id,
        username: data.user.username,
        tipo: roleRaw,              // guardo el rol tal cual viene
      }));

      // Debug rápido (si necesitas ver qué llega):
      // console.log('ROLE FROM API:', roleRaw);

      const isLocalPath = nextParam && nextParam.startsWith('/');

      if (isLocalPath) {
        navigate(nextParam, { replace: true });
      } else if (role.includes('admin')) {
        navigate('/admin', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      const msg = err?.response?.data?.error || `Error ${err?.response?.status || ''} iniciando sesión`;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto p-6 mt-10 bg-white shadow-md rounded-md">
      <h2 className="text-2xl font-bold mb-1 text-center">🔐 Iniciar sesión</h2>
      <p className="text-center text-gray-500 mb-4 text-sm">{API}</p>

      {error && (
        <div className="mb-4 rounded bg-red-50 text-red-700 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block mb-1 font-semibold" htmlFor="user">Usuario</label>
          <input
            id="user"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full border border-gray-300 rounded-md p-2"
            placeholder="tu_usuario"
            autoComplete="username"
            required
          />
        </div>

        <div>
          <label className="block mb-1 font-semibold" htmlFor="pwd">Contraseña</label>
          <div className="flex">
            <input
              id="pwd"
              type={showPwd ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-l-md p-2"
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPwd(v => !v)}
              className="px-3 border border-l-0 border-gray-300 rounded-r-md text-sm text-gray-600"
              aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              title={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {showPwd ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white w-full py-2 rounded-md font-semibold"
        >
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>

      <div className="mt-6 border-t pt-4 text-center">
        <p className="text-gray-600 text-sm">¿No tienes cuenta?</p>
        <Link
          to="/register"
          className="inline-block mt-2 px-4 py-2 rounded-md bg-green-600 hover:bg-green-700 text-white"
        >
          Crear cuenta
        </Link>
      </div>
    </div>
  );
}
