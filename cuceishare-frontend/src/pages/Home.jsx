// src/pages/Home.jsx
import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState, useCallback } from 'react';

/** tiny utility */
const cx = (...xs) => xs.filter(Boolean).join(' ');

// Cada materia puede tener un slug "visual" y un slug de ruta real
const SUBJECTS = [
  {
    slug: 'ed1',
    routeSlug: 'ed1',
    preSlug: 'ed1',
    nombre: 'Estructuras de Datos I',
    desc: 'Ruta por bloques del programa oficial.',
    comingSoon: false,
  },
  {
    slug: 'administracion-servidores',   // identificador “humano”
    routeSlug: 'aserv',                  // 👈 rutas reales existentes
    preSlug: 'aserv',
    nombre: 'Administración de Servidores',
    desc: 'Unidades, servicios de red y seguridad.',
    comingSoon: false,
  },
  {
    slug: 'mineria-datos',
    routeSlug: 'mineria',                // puedes cambiarlo cuando crees los archivos
    preSlug: 'mineria',
    nombre: 'Minería de Datos',
    desc: 'Preparación, modelos y evaluación.',
    comingSoon: true,                    // 👈 deshabilita CTAs hasta que exista
  },
];

const LS_SUBJECT = 'lastSubjectSlug';

export default function Home() {
  /** sesión (tu login propio en localStorage) */
  const sesion = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('usuario')); } catch { return null; }
  }, []);

  /** materias disponibles */
  const subjects = SUBJECTS;

  /** selección persistida */
  const initial = useMemo(() => {
    const stored = localStorage.getItem(LS_SUBJECT);
    return subjects.some(s => s.slug === stored) ? stored : subjects[0].slug;
  }, [subjects]);

  const [subject, setSubject] = useState(initial);
  useEffect(() => { localStorage.setItem(LS_SUBJECT, subject); }, [subject]);

  const current = subjects.find(s => s.slug === subject) || subjects[0];

  /** rutas segun materia (usa routeSlug/preSlug reales) */
  const hrefRuta   = `/ruta/${current.routeSlug}`;
  const hrefPre    = `/pre-eval/${current.preSlug}`;
  const hrefBuscar = `/buscar?materia=${current.routeSlug}`;

  /** accesos de usuario */
  const hrefPerfil = sesion ? '/perfil' : '/login';
  const hrefSubir  = sesion ? '/subir'  : '/login';

  /** progreso guardado de la materia actual (opcional) */
  const hasProgress = useMemo(() => {
    try { return !!JSON.parse(localStorage.getItem(`${current.routeSlug}:preeval:resultados`)); }
    catch { return false; }
  }, [current.routeSlug]);

  /** accesibilidad: manejar tabs con teclado */
  const onKeySelect = useCallback((e, slug, disabled) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSubject(slug);
    }
  }, []);

  /** estilos */
  const btnPrimary = "inline-flex items-center justify-center rounded-xl bg-slate-900 text-white px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-black active:bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-50 disabled:cursor-not-allowed";
  const btnGhost   = "inline-flex items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:opacity-50 disabled:cursor-not-allowed";
  const pill       = "inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-xs";

  const SegBtn = ({ value, label, active, disabled }) => (
    <button
      type="button"
      onClick={() => !disabled && setSubject(value)}
      onKeyDown={(e) => onKeySelect(e, value, disabled)}
      role="tab"
      aria-selected={active}
      aria-disabled={disabled}
      className={cx(
        "px-3 py-1.5 text-sm rounded-lg border transition",
        disabled && "opacity-50 cursor-not-allowed",
        !disabled && (active
          ? "bg-slate-900 text-white border-slate-900 shadow-sm"
          : "bg-white text-slate-700 hover:bg-slate-50")
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-b from-slate-50 to-white text-slate-900">
      {/* Announcement / login nudger */}
      {!sesion && (
        <div className="bg-slate-900 text-white">
          <div className="max-w-6xl mx-auto px-4 py-2 text-sm flex items-center justify-between">
            <span>🎓 Crea tu cuenta y guarda tu progreso.</span>
            <Link to="/register" className="underline underline-offset-2 hover:no-underline">Registrarme</Link>
          </div>
        </div>
      )}

      {/* HERO */}
      <section className="max-w-6xl mx-auto px-4 pt-10 md:pt-14">
        <div className="rounded-2xl border bg-white shadow-sm p-6 md:p-10 relative overflow-hidden">
          {/* background accent */}
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-indigo-100 blur-3xl opacity-60" />
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between relative">
            <div className="min-w-0">
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                Aprende con enfoque. <span className="text-slate-400 font-black">|</span> Sin ruido.
              </h1>
              <p className="mt-2 text-slate-600 max-w-2xl leading-relaxed">
                Realiza un diagnóstico rápido, estudia con apuntes curados y valida con práctica enfocada.
              </p>
              <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-slate-400" />
                  {current.nombre}
                </span>
                {hasProgress && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      Progreso guardado
                    </span>
                  </>
                )}
                {current.comingSoon && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      Próximamente
                    </span>
                  </>
                )}
              </div>

              {/* CTAs principales */}
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to={hrefRuta} className={btnPrimary} aria-disabled={current.comingSoon} onClick={e=>{ if(current.comingSoon) e.preventDefault(); }}>
                  Ir a mi ruta
                </Link>
                <Link to={hrefPre} className={btnGhost} aria-disabled={current.comingSoon} onClick={e=>{ if(current.comingSoon) e.preventDefault(); }}>
                  Pre-evaluación
                </Link>
                <Link to={hrefBuscar} className={btnGhost}>
                  Explorar apuntes
                </Link>
                <Link to={hrefSubir} className={btnGhost}>
                  Subir apunte
                </Link>
                <Link to={hrefPerfil} className={btnGhost}>
                  {sesion ? 'Mi perfil' : 'Iniciar sesión'}
                </Link>
              </div>
            </div>

            {/* Selector de materia (tabs) */}
            <div className="shrink-0">
              <div className="text-xs text-slate-500 mb-1">Materia</div>
              <div
                role="tablist"
                aria-label="Selector de materia"
                className="flex gap-1.5 rounded-lg p-1 bg-slate-50 border"
              >
                {subjects.map(s => (
                  <SegBtn
                    key={s.slug}
                    value={s.slug}
                    label={s.nombre}
                    active={subject === s.slug}
                    disabled={s.comingSoon}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pasos */}
      <section className="max-w-6xl mx-auto px-4 mt-8">
        <div className="grid md:grid-cols-3 gap-3">
          {[
            { t: 'Diagnóstico', d: 'Pre-evaluación por bloques.' },
            { t: 'Refuerzo', d: 'Apuntes y recursos relacionados.' },
            { t: 'Práctica', d: 'Feedback inmediato.' },
          ].map((s, i) => (
            <div key={i} className="rounded-2xl border bg-white p-4 hover:shadow-sm transition">
              <div className="text-sm font-semibold">{s.t}</div>
              <div className="text-sm text-slate-600 mt-1">{s.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Materias */}
      <section className="max-w-6xl mx-auto px-4 mt-10 md:mt-12">
        <div className="flex items-end justify-between gap-3 mb-3">
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">Materias</h2>
          <div className="text-sm text-slate-500">Elige una para personalizar la experiencia</div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {subjects.map((m) => {
            const progress = (() => {
              try { return !!JSON.parse(localStorage.getItem(`${m.routeSlug}:preeval:resultados`)); }
              catch { return false; }
            })();
            const active = subject === m.slug;

            return (
              <article
                key={m.slug}
                className={cx(
                  "group rounded-2xl border bg-white p-5 hover:shadow-sm transition",
                  active && "ring-1 ring-slate-900/10"
                )}
              >
                <header className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => !m.comingSoon && setSubject(m.slug)}
                    onKeyDown={(e) => onKeySelect(e, m.slug, m.comingSoon)}
                    className={cx("text-left", m.comingSoon && "opacity-60 cursor-not-allowed")}
                    title={m.comingSoon ? 'Próximamente' : 'Usar esta materia en los botones principales'}
                  >
                    <h3 className="text-base font-semibold leading-tight">{m.nombre}</h3>
                    <p className="mt-1 text-sm text-slate-600">{m.desc}</p>
                  </button>

                  <div className="flex items-center gap-2">
                    {progress && (
                      <span className="shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium text-slate-700">
                        Progreso
                      </span>
                    )}
                    {m.comingSoon ? (
                      <span className="text-[11px] text-amber-600 font-medium">Próx.</span>
                    ) : active ? (
                      <span className="text-[11px] text-indigo-600 font-medium">Activo</span>
                    ) : null}
                  </div>
                </header>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    to={`/ruta/${m.routeSlug}`}
                    className={btnPrimary}
                    aria-disabled={m.comingSoon}
                    onClick={(e)=>{ if(m.comingSoon) e.preventDefault(); }}
                  >
                    Ruta
                  </Link>
                  <Link
                    to={`/pre-eval/${m.preSlug}`}
                    className={btnGhost}
                    aria-disabled={m.comingSoon}
                    onClick={(e)=>{ if(m.comingSoon) e.preventDefault(); }}
                  >
                    Pre-evaluación
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* CTA final */}
      <section className="max-w-6xl mx-auto px-4 my-12 pb-16">
        <div className="rounded-2xl border bg-white p-6 md:p-8 flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg md:text-xl font-semibold">¿Listo para continuar?</h3>
              <p className="text-slate-600 mt-1">
                Elige la materia y continúa tu ruta o realiza tu diagnóstico.
              </p>
            </div>

            <div className="hidden md:flex items-center gap-2">
              <div className="text-xs text-slate-500">Materia</div>
              <div role="tablist" className="flex gap-1.5 rounded-lg p-1 bg-slate-50 border">
                {subjects.map(s => (
                  <SegBtn key={s.slug} value={s.slug} label={s.nombre} active={subject === s.slug} disabled={s.comingSoon} />
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link to={hrefRuta} className={btnPrimary} aria-disabled={current.comingSoon} onClick={e=>{ if(current.comingSoon) e.preventDefault(); }}>
              Ir a mi ruta
            </Link>
            <Link to={hrefPre} className={btnGhost} aria-disabled={current.comingSoon} onClick={e=>{ if(current.comingSoon) e.preventDefault(); }}>
              Pre-evaluación
            </Link>
            <Link to={hrefBuscar} className={btnGhost}>Explorar apuntes</Link>
            <Link to={hrefSubir} className={btnGhost}>{sesion ? 'Subir apunte' : 'Inicia sesión para subir'}</Link>
            <Link to={hrefPerfil} className={btnGhost}>{sesion ? 'Mi perfil' : 'Iniciar sesión'}</Link>
          </div>

          {/* mini chips */}
          <div className="flex flex-wrap gap-2 text-xs">
            <span className={pill}>⚡ Rápido</span>
            <span className={pill}>🔒 Privacidad</span>
            <span className={pill}>📚 Contenido enfocado</span>
          </div>
        </div>
      </section>
    </div>
  );
}
