import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';

const cx = (...xs) => xs.filter(Boolean).join(' ');

// =====================
// Materias
// =====================
const SUBJECTS = [
  { slug: 'ed1', routeSlug: 'ed1', preSlug: 'ed1', nombre: 'Estructuras de Datos I', desc: 'Ruta por bloques del programa oficial.', comingSoon: false, icon: '📚' },
  { slug: 'administracion-servidores', routeSlug: 'aserv', preSlug: 'aserv', nombre: 'Administración de Servidores', desc: 'Unidades, servicios de red y seguridad.', comingSoon: false, icon: '🖥️' },
  { slug: 'mineria-datos', routeSlug: 'mineria-datos', preSlug: 'mineria-datos', nombre: 'Minería de Datos', desc: 'Preparación, modelos y evaluación.', comingSoon: false, icon: '⛏️' },
  { slug: 'redes', routeSlug: 'redes', preSlug: 'redes', nombre: 'Redes', desc: 'Fundamentos, protocolos y direccionamiento.', comingSoon: false, icon: '🌐' },
  { slug: 'algoritmia', routeSlug: 'algoritmia', preSlug: 'algoritmia', nombre: 'Algoritmia', desc: 'Análisis, complejidad y diseño de algoritmos.', comingSoon: false, icon: '🧩' },

  // Programación
  { slug: 'programacion', routeSlug: 'programacion', preSlug: 'programacion', nombre: 'Programación', desc: 'Fundamentos, POO, estructuras y archivos.', comingSoon: false, icon: '💻' },

  // Ingeniería de Software
  { slug: 'ingsoft', routeSlug: 'ingsoft', preSlug: 'ingsoft', nombre: 'Ingeniería de Software', desc: 'Procesos, requisitos, diseño, pruebas y mantenimiento.', comingSoon: false, icon: '🛠️' },

  // Seguridad de la Información (ajustada a seginf)
  { slug: 'seguridad', routeSlug: 'seginf', preSlug: 'seginf', nombre: 'Seguridad de la Información', desc: 'Fundamentos, controles, riesgos y cumplimiento.', comingSoon: false, icon: '🛡️' },

  { slug: 'teoria', routeSlug: 'teoria', preSlug: 'teoria', nombre: 'Teoría de la Computación', desc: 'Autómatas, gramáticas y decidibilidad.', comingSoon: false, icon: '🧠' },
];

const LS_SUBJECT = 'lastSubjectSlug';

// =====================
// Subcomponentes
// =====================
const SegBtn = ({ value, label, active, disabled, onClick, onKeyDown }) => (
  <button
    type="button"
    onClick={() => !disabled && onClick?.(value)}
    onKeyDown={(e) => onKeyDown?.(e, value, disabled)}
    role="tab"
    aria-selected={active}
    aria-disabled={disabled}
    className={cx(
      "px-3 py-1.5 text-xs sm:text-sm rounded-full border transition whitespace-nowrap",
      disabled && "opacity-50 cursor-not-allowed",
      !disabled && (active
        ? "bg-slate-900 text-white border-slate-900 shadow-sm"
        : "bg-white text-slate-700 hover:bg-slate-50")
    )}
    title={label}
  >
    {label}
  </button>
);

// Fila desplazable con degradados + flechas y scrollbar oculto
function ScrollRow({ ariaLabel, children, className = '' }) {
  const ref = useRef(null);
  const [canL, setCanL] = useState(false);
  const [canR, setCanR] = useState(false);

  const recompute = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanL(el.scrollLeft > 0);
    setCanR(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    recompute();
    const on = () => recompute();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, [recompute]);

  const onScroll = () => recompute();

  const scrollBy = (dx) => {
    ref.current?.scrollBy({ left: dx, behavior: 'smooth' });
  };

  return (
    <div className={cx("relative", className)}>
      {/* Gradientes laterales */}
      {canL && <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-white to-transparent rounded-l-lg" />}
      {canR && <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent rounded-r-lg" />}

      {/* Flechas */}
      <button
        type="button"
        onClick={() => scrollBy(-240)}
        className={cx(
          "hidden md:grid place-items-center absolute left-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full border bg-white hover:bg-slate-50 shadow-sm",
          !canL && "opacity-0 pointer-events-none"
        )}
        aria-label="Desplazar a la izquierda"
      >‹</button>
      <button
        type="button"
        onClick={() => scrollBy(240)}
        className={cx(
          "hidden md:grid place-items-center absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full border bg-white hover:bg-slate-50 shadow-sm",
          !canR && "opacity-0 pointer-events-none"
        )}
        aria-label="Desplazar a la derecha"
      >›</button>

      {/* Contenedor scrollable */}
      <div
        ref={ref}
        onScroll={onScroll}
        role="tablist"
        aria-label={ariaLabel}
        className={cx(
          "flex gap-1.5 p-1 rounded-lg bg-slate-50 border overflow-x-auto scroll-smooth",
          "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        )}
      >
        {children}
      </div>
    </div>
  );
}

export default function Home() {
  // sesión (tu login propio en localStorage)
  const sesion = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('usuario')); } catch { return null; }
  }, []);

  const subjects = SUBJECTS;

  // selección persistida
  const initial = useMemo(() => {
    const stored = localStorage.getItem(LS_SUBJECT);
    return subjects.some(s => s.slug === stored) ? stored : subjects[0].slug;
  }, [subjects]);

  const [subject, setSubject] = useState(initial);
  useEffect(() => { localStorage.setItem(LS_SUBJECT, subject); }, [subject]);

  const current = subjects.find(s => s.slug === subject) || subjects[0];

  // rutas segun materia
  const hrefRuta   = `/ruta/${current.routeSlug}`;
  const hrefPre    = `/pre-eval/${current.preSlug}`;
  const hrefBuscar = `/buscar?materia=${current.routeSlug}`;
  const hrefPerfil = sesion ? '/perfil' : '/login';
  const hrefSubir  = sesion ? '/subir'  : '/login';

  // progreso guardado de la materia actual (opcional)
  const hasProgress = useMemo(() => {
    try { return !!JSON.parse(localStorage.getItem(`${current.routeSlug}:preeval:resultados`)); }
    catch { return false; }
  }, [current.routeSlug]);

  // accesibilidad: tabs con teclado
  const onKeySelect = useCallback((e, slug, disabled) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSubject(slug);
    }
  }, []);

  // estilos base
  const btnPrimary = "inline-flex items-center justify-center rounded-xl bg-slate-900 text-white px-4 py-3 text-sm sm:text-base font-semibold shadow-sm hover:bg-black active:bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-50 disabled:cursor-not-allowed";
  const btnGhost   = "inline-flex items-center justify-center rounded-xl border px-4 py-3 text-sm sm:text-base font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:opacity-50 disabled:cursor-not-allowed";
  const pill       = "inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-xs";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      {/* Announcement / login nudger */}
      {!sesion && (
        <div className="bg-slate-900 text-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-2 text-xs sm:text-sm flex items-center justify-between">
            <span>🎓 Crea tu cuenta y guarda tu progreso.</span>
            <Link to="/register" className="underline underline-offset-2 hover:no-underline">Registrarme</Link>
          </div>
        </div>
      )}

      {/* HERO */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 md:pt-12">
        <div className="rounded-2xl border bg-white shadow-sm p-4 sm:p-6 md:p-8 relative overflow-hidden">
          {/* accent */}
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-indigo-100 blur-3xl opacity-60" />
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-5 sm:gap-6 items-start relative">
            {/* Copy + CTA */}
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl md:text-[2.5rem] leading-tight font-extrabold tracking-tight">
                Aprende con enfoque. <span className="text-slate-300 font-black">|</span> Sin ruido.
              </h1>
              <p className="mt-2 sm:mt-3 text-slate-600 max-w-2xl leading-relaxed text-sm sm:text-base">
                Realiza un diagnóstico rápido, estudia con apuntes curados y valida con práctica enfocada.
              </p>

              {/* Selector compacto (mobile-first) */}
              <div className="mt-4 sm:mt-5 space-y-3">
                {/* Select (móvil) */}
                <div className="md:hidden">
                  <label className="block text-xs text-slate-500 mb-1">Materia</label>
                  <select
                    value={subject}
                    onChange={(e)=>setSubject(e.target.value)}
                    className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
                  >
                    {subjects.map(s => (
                      <option key={s.slug} value={s.slug}>{s.nombre}</option>
                    ))}
                  </select>
                </div>

                {/* Chips (desktop) con scroll oculto + flechas */}
                <div className="hidden md:block">
                  <div className="text-xs text-slate-500 mb-1">Materia</div>
                  <ScrollRow ariaLabel="Selector de materia">
                    {subjects.map(s => (
                      <SegBtn
                        key={s.slug}
                        value={s.slug}
                        label={s.nombre}
                        active={subject === s.slug}
                        disabled={s.comingSoon}
                        onClick={setSubject}
                        onKeyDown={onKeySelect}
                      />
                    ))}
                  </ScrollRow>
                </div>
              </div>

              {/* Estado actual */}
              <div className="mt-3 sm:mt-4 flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-600">
                <span className={pill}>• {current.nombre}</span>
                {hasProgress && <span className={cx(pill, "bg-emerald-50 text-emerald-700")}>● Progreso guardado</span>}
              </div>

              {/* CTAs principales */}
              <div className="mt-5 sm:mt-6 flex flex-col sm:flex-row flex-wrap gap-2.5 sm:gap-3">
                <Link to={hrefRuta} className={cx(btnPrimary, "w-full sm:w-auto")} aria-disabled={current.comingSoon} onClick={e=>{ if(current.comingSoon) e.preventDefault(); }}>
                  Ir a mi ruta
                </Link>
                <Link to={hrefPre} className={cx(btnGhost, "w-full sm:w-auto")} aria-disabled={current.comingSoon} onClick={e=>{ if(current.comingSoon) e.preventDefault(); }}>
                  Pre-evaluación
                </Link>
                <Link to={hrefBuscar} className={cx(btnGhost, "w-full sm:w-auto")}>Explorar apuntes</Link>
                <Link to={hrefSubir} className={cx(btnGhost, "w-full sm:w-auto")}>Subir apunte</Link>
                <Link to={hrefPerfil} className={cx(btnGhost, "w-full sm:w-auto")}>{sesion ? 'Mi perfil' : 'Iniciar sesión'}</Link>
              </div>
            </div>

            {/* Panel derecho: tarjetas rápidas */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-3 sm:gap-4">
              {[
                { t: 'Diagnóstico', d: 'Pre-evaluación por bloques.', emoji: '🧪' },
                { t: 'Refuerzo', d: 'Apuntes y recursos clave.', emoji: '🧠' },
                { t: 'Práctica', d: 'Feedback inmediato.', emoji: '✅' },
                { t: 'Progreso', d: 'Guarda y continúa luego.', emoji: '💾' },
              ].map((s, i) => (
                <div key={i} className="rounded-2xl border bg-white p-3 sm:p-4 hover:shadow-sm transition min-h-[96px]">
                  <div className="text-xl sm:text-2xl mb-1">{s.emoji}</div>
                  <div className="text-sm font-semibold">{s.t}</div>
                  <div className="text-xs sm:text-sm text-slate-600 mt-1">{s.d}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Materias */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 sm:mt-10 md:mt-12">
        <div className="flex items-center sm:items-end justify-between gap-2 sm:gap-3 mb-2 sm:mb-3">
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight">Materias</h2>
          <div className="hidden sm:block text-sm text-slate-500">Elige una para personalizar la experiencia</div>
        </div>

        {/* Grid responsivo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
          {subjects.map((m) => {
            const progress = (() => {
              try { return !!JSON.parse(localStorage.getItem(`${m.routeSlug}:preeval:resultados`)); }
              catch { return false; }
            })();
            const active = subject === m.slug;

            return (
              <article
                key={m.slug}
                className="group rounded-2xl border bg-white p-4 sm:p-5 hover:shadow-sm transition h-full flex flex-col"
              >
                {/* CONTENIDO */}
                <div className="flex-1 min-h-[96px] flex flex-col">
                  <button
                    type="button"
                    onClick={() => !m.comingSoon && setSubject(m.slug)}
                    onKeyDown={(e) => onKeySelect(e, m.slug, m.comingSoon)}
                    className={cx("text-left", m.comingSoon && "opacity-60 cursor-not-allowed")}
                    title={m.comingSoon ? 'Próximamente' : 'Usar esta materia en los botones principales'}
                  >
                    <div className="flex items-center justify-between gap-2 sm:gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="inline-grid place-items-center h-8 w-8 rounded-xl bg-slate-100">{m.icon || '📘'}</span>
                        <h3 className={cx("text-sm sm:text-base font-semibold leading-tight truncate", active && "text-indigo-700")}>
                          {m.nombre}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {progress && (
                          <span className="rounded-full border px-2 py-0.5 text-[10px] sm:text-[11px] font-medium text-slate-700">
                            Progreso
                          </span>
                        )}
                        {m.comingSoon ? (
                          <span className="text-[10px] sm:text-[11px] text-amber-600 font-medium">Próx.</span>
                        ) : active ? (
                          <span className="text-[10px] sm:text-[11px] text-indigo-600 font-medium">Activo</span>
                        ) : null}
                      </div>
                    </div>
                  </button>

                  <p className="mt-2 text-xs sm:text-sm text-slate-600 line-clamp-2 min-h-[40px]">
                    {m.desc}
                  </p>

                  <div className="mt-auto" />
                </div>

                {/* CTAs */}
                <div className="mt-3 sm:mt-4 flex flex-col xs:flex-row flex-wrap gap-2">
                  <Link
                    to={`/ruta/${m.routeSlug}`}
                    className={cx(btnPrimary, "w-full xs:w-auto")}
                    aria-disabled={m.comingSoon}
                    onClick={(e)=>{ if(m.comingSoon) e.preventDefault(); }}
                  >
                    Ruta
                  </Link>
                  <Link
                    to={`/pre-eval/${m.preSlug}`}
                    className={cx(btnGhost, "w-full xs:w-auto")}
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

      {/* CTA final — misma UX del selector, sin scrollbars feas */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 my-10 sm:my-12 pb-16">
        <div className="rounded-2xl border bg-white p-5 sm:p-6 md:p-8 flex flex-col gap-4 sm:gap-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="text-base sm:text-lg md:text-xl font-semibold">¿Listo para continuar?</h3>
              <p className="text-slate-600 mt-1 text-sm sm:text-base">
                Elige la materia y continúa tu ruta o realiza tu diagnóstico.
              </p>
            </div>

            <div className="hidden md:block min-w-0 flex-1">
              <ScrollRow ariaLabel="Selector de materia (CTA final)">
                {subjects.map(s => (
                  <SegBtn
                    key={s.slug}
                    value={s.slug}
                    label={s.nombre}
                    active={subject === s.slug}
                    disabled={s.comingSoon}
                    onClick={setSubject}
                    onKeyDown={onKeySelect}
                  />
                ))}
              </ScrollRow>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap gap-2.5 sm:gap-3">
            <Link to={hrefRuta} className={cx(btnPrimary, "w-full sm:w-auto")} aria-disabled={current.comingSoon} onClick={e=>{ if(current.comingSoon) e.preventDefault(); }}>
              Ir a mi ruta
            </Link>
            <Link to={hrefPre} className={cx(btnGhost, "w-full sm:w-auto")} aria-disabled={current.comingSoon} onClick={e=>{ if(current.comingSoon) e.preventDefault(); }}>
              Pre-evaluación
            </Link>
            <Link to={hrefBuscar} className={cx(btnGhost, "w-full sm:w-auto")}>Explorar apuntes</Link>
            <Link to={hrefSubir} className={cx(btnGhost, "w-full sm:w-auto")}>{sesion ? 'Subir apunte' : 'Inicia sesión para subir'}</Link>
            <Link to={hrefPerfil} className={cx(btnGhost, "w-full sm:w-auto")}>{sesion ? 'Mi perfil' : 'Iniciar sesión'}</Link>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px] sm:text-xs">
            <span className={pill}>⚡ Rápido</span>
            <span className={pill}>🔒 Privacidad</span>
            <span className={pill}>📚 Contenido enfocado</span>
          </div>
        </div>
      </section>
    </div>
  );
}
