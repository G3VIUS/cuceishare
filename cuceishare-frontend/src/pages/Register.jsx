// src/pages/Register.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: '',
    nombre_completo: '',
    correo: '',
    password: '',
    confirm: '',
  });
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(false);

  const onChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
    setOk('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setOk('');

    if (!form.username.trim()) return setError('El usuario es obligatorio.');
    if (!form.password) return setError('La contraseña es obligatoria.');
    if (form.password.length < 4) return setError('La contraseña debe tener al menos 4 caracteres.');
    if (form.password !== form.confirm) return setError('Las contraseñas no coinciden.');
    if (form.correo && !/^\S+@\S+\.\S+$/.test(form.correo)) return setError('El correo no es válido.');

    try {
      setLoading(true);
      const payload = {
        username: form.username.trim(),
        password: form.password,
        role: 'estudiante', // 👈 siempre estudiante
        nombre_completo: form.nombre_completo || undefined,
        correo: form.correo || undefined,
      };
      const { data } = await axios.post(`${API}/auth/register`, payload);

      // Guardar sesión automáticamente
      localStorage.setItem('token', data.token);
      localStorage.setItem('usuario', JSON.stringify({
        id: data.user.id,
        username: data.user.username,
        tipo: data.user.role,
      }));

      setOk('Cuenta creada con éxito. Redirigiendo…');
      setTimeout(() => navigate('/'), 400);
    } catch (err) {
      const msg = err?.response?.data?.error || 'No se pudo crear la cuenta';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 mt-10 bg-white shadow-md rounded-md">
      <h2 className="text-2xl font-bold mb-1 text-center">🆕 Crear cuenta</h2>
      <p className="text-center text-gray-500 mb-4 text-sm">{API}</p>

      {error && <div className="mb-3 rounded bg-red-50 text-red-700 px-3 py-2 text-sm">{error}</div>}
      {ok && <div className="mb-3 rounded bg-emerald-50 text-emerald-700 px-3 py-2 text-sm">{ok}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1 font-semibold">Usuario *</label>
          <input
            name="username"
            value={form.username}
            onChange={onChange}
            className="w-full border rounded-md p-2"
            placeholder="tu_usuario"
            autoComplete="username"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block mb-1 font-semibold">Nombre completo</label>
            <input
              name="nombre_completo"
              value={form.nombre_completo}
              onChange={onChange}
              className="w-full border rounded-md p-2"
              placeholder="Tu nombre"
              autoComplete="name"
            />
          </div>
          <div>
            <label className="block mb-1 font-semibold">Correo</label>
            <input
              name="correo"
              type="email"
              value={form.correo}
              onChange={onChange}
              className="w-full border rounded-md p-2"
              placeholder="tu@correo.com"
              autoComplete="email"
            />
          </div>
        </div>

        <div>
          <label className="block mb-1 font-semibold">Contraseña *</label>
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={onChange}
            className="w-full border rounded-md p-2"
            placeholder="••••••••"
            autoComplete="new-password"
            required
          />
          <p className="text-xs text-gray-500 mt-1">Mínimo 4 caracteres.</p>
        </div>

        <div>
          <label className="block mb-1 font-semibold">Confirmar contraseña *</label>
          <input
            name="confirm"
            type="password"
            value={form.confirm}
            onChange={onChange}
            className="w-full border rounded-md p-2"
            placeholder="••••••••"
            autoComplete="new-password"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white w-full py-2 rounded-md font-semibold"
        >
          {loading ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
      </form>

      <div className="mt-6 border-t pt-4 text-center">
        <p className="text-gray-600 text-sm">¿Ya tienes cuenta?</p>
        <Link
          to="/login"
          className="inline-block mt-2 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white"
        >
          Iniciar sesión
        </Link>
      </div>
    </div>
  );
}
