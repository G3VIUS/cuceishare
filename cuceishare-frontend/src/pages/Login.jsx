import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();

    // Simulación simple
    if ((usuario === 'admin' || usuario === 'estudiante') && password === '1234') {
      localStorage.setItem('usuario', JSON.stringify({ tipo: usuario }));
      navigate('/');
    } else {
      setError('Credenciales inválidas');
    }
  };

  return (
    <div className="max-w-sm mx-auto p-6 mt-10 bg-white shadow-md rounded-md">
      <h2 className="text-2xl font-bold mb-4 text-center">🔐 Iniciar sesión</h2>

      {error && <p className="text-red-600 mb-4 text-sm">{error}</p>}

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block mb-1 font-semibold">Usuario</label>
          <input
            type="text"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            className="w-full border border-gray-300 rounded-md p-2"
            placeholder="admin o estudiante"
          />
        </div>

        <div>
          <label className="block mb-1 font-semibold">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-300 rounded-md p-2"
            placeholder="1234"
          />
        </div>

        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white w-full py-2 rounded-md"
        >
          Entrar
        </button>
      </form>
    </div>
  );
}
