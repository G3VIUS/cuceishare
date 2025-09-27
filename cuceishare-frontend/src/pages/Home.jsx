// src/pages/Home.jsx
import { Link } from 'react-router-dom';

const SUBJECTS = [
  {
    slug: 'ed1',
    nombre: 'Estructura de Datos I',
    rutaHref: '/ruta/ed1',           // tu vista actual de ruta (puede quedar así mientras migras)
    preHref: '/pre-eval/ed1',        // ahora usa el genérico
    grad: 'from-purple-500 to-indigo-500',
  },
  {
    slug: 'administracion-servidores',
    nombre: 'Administración de Servidores',
    rutaHref: '/ruta/administracion-servidores', // si aún no existe, apunta a /pre-eval para no romper
    preHref: '/pre-eval/administracion-servidores',
    grad: 'from-indigo-500 to-blue-500',
  },
  // agrega más materias aquí…
];

export default function Home() {
  let sesion = null;
  // Puedes guardar resultados por materia: `${slug}:preeval:resultados`
  const progreso = {};
  try {
    sesion = JSON.parse(localStorage.getItem('usuario'));
    for (const s of SUBJECTS) {
      progreso[s.slug] = JSON.parse(localStorage.getItem(`${s.slug}:preeval:resultados`) || 'null');
    }
  } catch {
    // no-op
  }

  return (
    <div className="min-h-[calc(100vh-64px)]">
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 opacity-90" />
        <div className="max-w-7xl mx-auto px-6 py-16 md:py-24 text-white">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight drop-shadow">
              Potencia tu estudio con rutas de aprendizaje personalizadas
            </h1>
            <p className="mt-4 text-lg md:text-xl/relaxed text-white/90">
              Diagnosticamos tu nivel, reforzamos debilidades con apuntes y recursos, y validamos con prácticas.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {sesion ? (
                <>
                  <Link
                    to="/ruta/ed1"
                    className="inline-flex items-center gap-2 rounded-xl bg-white text-indigo-700 font-semibold px-5 py-3 shadow hover:shadow-md transition"
                  >
                    📈 Empezar Ruta ED I
                  </Link>
                  <Link
                    to="/pre-eval/ed1"
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-100 text-indigo-900 font-semibold px-5 py-3 hover:bg-white/90 transition"
                  >
                    📊 Pre-evaluación ED I
                  </Link>
                  <Link
                    to="/buscar"
                    className="inline-flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur text-white border border-white/30 font-semibold px-5 py-3 hover:bg-white/20 transition"
                  >
                    🔎 Explorar apuntes
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 rounded-xl bg-white text-indigo-700 font-semibold px-5 py-3 shadow hover:shadow-md transition"
                  >
                    🔑 Inicia sesión
                  </Link>
                  <Link
                    to="/register"
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-100 text-indigo-900 font-semibold px-5 py-3 hover:bg-white/90 transition"
                  >
                    🆕 Crear cuenta
                  </Link>
                </>
              )}
            </div>

            {sesion && (progreso['ed1'] || progreso['administracion-servidores']) && (
              <div className="mt-6 text-sm text-white/90">
                👉 Tienes resultados guardados de pre-evaluación:&nbsp;
                {Object.entries(progreso)
                  .filter(([, v]) => !!v)
                  .map(([slug], i) => (
                    <Link key={slug} to={`/pre-eval/${slug}`} className="underline font-semibold">
                      {i ? ', ' : ''}{slug}
                    </Link>
                  ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* PASOS */}
      <section className="max-w-7xl mx-auto px-6 -mt-10 md:-mt-14">
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { title: '1. Diagnóstico', desc: 'Pre-evaluación rápida por bloques del plan oficial.', icon: '🧭' },
            { title: '2. Reforzamiento', desc: 'Apuntes CUCEIShare + recursos externos curados.', icon: '📚' },
            { title: '3. Práctica', desc: 'Quizzes y ejercicios con feedback inmediato.', icon: '✅' },
          ].map((c, i) => (
            <div key={i} className="rounded-2xl bg-white shadow-md p-5">
              <div className="text-2xl">{c.icon}</div>
              <h3 className="mt-2 font-bold text-lg">{c.title}</h3>
              <p className="text-gray-600">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* MATERIAS */}
      <section className="max-w-7xl mx-auto px-6 mt-10 md:mt-16">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">Materias</h2>
          {sesion ? (
            <Link to="/ruta/ed1" className="text-indigo-700 font-semibold hover:underline">
              Ir a mi ruta →
            </Link>
          ) : (
            <Link to="/login" className="text-indigo-700 font-semibold hover:underline">
              Inicia sesión →
            </Link>
          )}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {SUBJECTS.map((s) => (
            <div key={s.slug} className="group relative overflow-hidden rounded-2xl bg-white border shadow-sm hover:shadow-lg transition">
              <div className={`h-24 bg-gradient-to-r ${s.grad}`} />
              <div className="p-5">
                <h3 className="text-lg font-bold">{s.nombre}</h3>
                <p className="text-gray-600 text-sm">
                  Plan basado en el programa oficial. Ruta adaptativa por bloques.
                </p>
                <div className="mt-4 flex gap-2">
                  <Link
                    to={s.rutaHref || s.preHref}
                    className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition"
                  >
                    Empezar ruta
                  </Link>
                  <Link
                    to={s.preHref}
                    className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-indigo-100 text-indigo-900 text-sm font-semibold hover:bg-indigo-200 transition"
                  >
                    Pre-evaluación
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="max-w-7xl mx-auto px-6 my-14">
        <div className="rounded-3xl bg-gradient-to-r from-indigo-600 to-purple-600 p-1">
          <div className="rounded-3xl bg-white p-6 md:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl md:text-2xl font-extrabold">¿Listo para tu siguiente sesión?</h3>
              <p className="text-gray-600">Continúa donde te quedaste o realiza tu diagnóstico inicial.</p>
            </div>
            <div className="flex gap-3">
              <Link
                to={sesion ? "/ruta/ed1" : "/login"}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 text-white font-semibold px-5 py-3 hover:bg-indigo-700 transition"
              >
                {sesion ? '📈 Ir a mi Ruta' : '🔑 Iniciar sesión'}
              </Link>
              <Link
                to="/pre-eval/ed1"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-100 text-indigo-900 font-semibold px-5 py-3 hover:bg-indigo-200 transition"
              >
                📊 Pre-evaluación ED I
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
