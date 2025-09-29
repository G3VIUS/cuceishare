// routes/route-subject.js
'use strict';

const express = require('express');
const router = express.Router({ mergeParams: true });

const { pool } = require('../db');
const { authenticate } = require('../middleware/auth');

/* ---------- helpers de introspección ---------- */
async function tableHasColumn(table, col) {
  const q = `
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name   = $1
       and column_name  = $2
     limit 1
  `;
  const r = await pool.query(q, [table, col]);
  return r.rowCount > 0;
}
async function getColumnType(table, col) {
  const q = `
    select data_type
      from information_schema.columns
     where table_schema = 'public'
       and table_name   = $1
       and column_name  = $2
     limit 1
  `;
  const r = await pool.query(q, [table, col]);
  return r.rowCount ? r.rows[0].data_type : null;
}
async function isColumnNotNull(table, col) {
  const q = `
    select is_nullable
      from information_schema.columns
     where table_schema = 'public'
       and table_name   = $1
       and column_name  = $2
     limit 1
  `;
  const r = await pool.query(q, [table, col]);
  if (!r.rowCount) return false;
  return String(r.rows[0].is_nullable).toUpperCase() === 'NO';
}

/* ---------- helpers de dominio genéricos ---------- */
async function getSubjectIdBySlug(slug) {
  if (!slug) return null;
  try {
    const r = await pool.query(`select id, nombre from subjects where slug = $1 limit 1`, [slug]);
    if (r.rowCount) return r.rows[0];
  } catch {}
  return null;
}
async function getQuizIdBySlug(slug, expectedType /* 'uuid' | 'integer' | 'text' */) {
  // 1) variable de entorno específica (opcional): QUIZ_{SLUG}_ID
  const envKey = `QUIZ_${String(slug || '').replace(/[^A-Z0-9]/ig, '_').toUpperCase()}_ID`;
  if (process.env[envKey]?.trim()) {
    const val = process.env[envKey].trim();
    if (expectedType === 'integer') {
      const n = parseInt(val, 10);
      return Number.isFinite(n) ? n : null;
    }
    return val;
  }
  // 2) por slug en tabla quizzes
  try {
    const r = await pool.query(
      `select id from quizzes where slug in ($1, $1||'_pre', 'pre-'||$1, $1||'-pre') order by created_at desc nulls last, id limit 1`,
      [slug]
    );
    if (r.rowCount) return r.rows[0].id;
  } catch {}

  // 3) fallback por subject_id (toma un quiz activo del subject si existe)
  try {
    const subj = await getSubjectIdBySlug(slug);
    if (subj?.id) {
      const r2 = await pool.query(
        `select id from quizzes
          where subject_id=$1::uuid and coalesce(is_active,true)=true
          order by created_at desc nulls last, id limit 1`,
        [subj.id]
      );
      if (r2.rowCount) return r2.rows[0].id;
    }
  } catch {}
  return null;
}

/* ---------- helper: elegir columna de orden en attempt_sessions ---------- */
async function pickSessionOrderExpr() {
  const hasFinished = await tableHasColumn('attempt_sessions', 'finished_at');
  const hasStarted  = await tableHasColumn('attempt_sessions', 'started_at');
  const hasCreated  = await tableHasColumn('attempt_sessions', 'created_at');

  if (hasFinished && hasStarted) return 'coalesce(finished_at, started_at)';
  if (hasFinished) return 'finished_at';
  if (hasStarted)  return 'started_at';
  if (hasCreated)  return 'created_at';
  // último recurso: por id (uuid) como aproximación de recencia
  return 'id';
}

/* =========================================================
   GET /api/:subject/pre-eval  (protegido)
   ========================================================= */
router.get('/pre-eval', authenticate, async (req, res) => {
  const subjectSlug = req.params.subject;
  try {
    const subj = await getSubjectIdBySlug(subjectSlug);
    if (!subj) return res.status(404).json({ error: `Materia no encontrada: ${subjectSlug}` });

    // Blocks de la materia
    const blks = await pool.query(
      `select id, code, titulo
         from blocks
        where subject_id = $1
        order by code asc, titulo asc`,
      [subj.id]
    );

    // Preguntas de esos blocks
    const qs = await pool.query(
      `select id, block_id, enunciado, tipo, dificultad
         from questions
        where block_id = any($1::uuid[])
        order by id asc`,
      [blks.rows.map(b => b.id)]
    );
    const qIds = qs.rows.map(r => r.id);

    // Opciones de esas preguntas
    let chs = { rows: [] };
    if (qIds.length) {
      chs = await pool.query(
        `select id, question_id, texto, es_correcta, correct
           from choices
          where question_id = any($1::uuid[])
          order by question_id, id`,
        [qIds]
      );
    }

    // Pistas para abiertas
    let keys = { rows: [] };
    try {
      if (qIds.length) {
        keys = await pool.query(
          `select id, question_id, palabra
             from open_keys
            where question_id = any($1::uuid[])
            order by question_id, palabra`,
          [qIds]
        );
      }
    } catch {}

    res.json({
      subject: { slug: subjectSlug, nombre: subj.nombre || subjectSlug },
      blocks: blks.rows,
      questions: qs.rows,
      choices: chs.rows,
      openKeys: keys.rows,
    });
  } catch (err) {
    console.error('[PRE-EVAL generic] error:', err);
    res.status(500).json({ error: 'No se pudo cargar la pre-evaluación' });
  }
});

/* =========================================================
   POST /api/:subject/attempts  (protegido)
   Body: { respuestas:[{ blockId, questionId, type, choiceId?, answerText? }] }
   Opcional: sessionId  (si no viene, se crea)
   ========================================================= */
router.post('/attempts', authenticate, async (req, res) => {
  const subjectSlug = req.params.subject;
  const { sessionId: bodySession, respuestas = [] } = req.body;
  const hdrSession = req.header('x-session-id') || null;
  let effectiveSession = bodySession || hdrSession || null;

  // user_id del JWT (en tu esquema es integer)
  let userId = req.user?.sub ?? req.user?.id ?? null;
  if (!userId) return res.status(401).json({ error: 'No autenticado' });
  if (typeof userId === 'string') {
    const n = parseInt(userId, 10);
    if (!Number.isFinite(n)) return res.status(400).json({ error: 'user_id inválido' });
    userId = n;
  }
  if (!Array.isArray(respuestas) || respuestas.length === 0) {
    return res.status(400).json({ error: 'No hay respuestas' });
  }

  try {
    const subj = await getSubjectIdBySlug(subjectSlug);
    if (!subj) return res.status(404).json({ error: `Materia no encontrada: ${subjectSlug}` });

    // introspección attempts.*
    const [hasUserId, hasSubjectId] = await Promise.all([
      tableHasColumn('attempts', 'user_id'),
      tableHasColumn('attempts', 'subject_id'),
    ]);
    const [userColType, subjectColType] = await Promise.all([
      hasUserId ? getColumnType('attempts', 'user_id') : Promise.resolve(null),
      hasSubjectId ? getColumnType('attempts', 'subject_id') : Promise.resolve(null),
    ]);
    const userCastAttempts = hasUserId
      ? (userColType === 'uuid' ? '::uuid' : (userColType === 'integer' ? '::int' : ''))
      : '';
    const subjectCastAttempts = hasSubjectId
      ? (subjectColType === 'uuid' ? '::uuid' : (subjectColType === 'integer' ? '::int' : ''))
      : '';

    // ===== asegurar/crear attempt_sessions =====
    const hasAttemptSessions = await (async () => {
      try {
        const r = await pool.query(`select to_regclass('public.attempt_sessions') rel`);
        return r.rows[0]?.rel !== null;
      } catch { return false; }
    })();

    let quizIdForSess = null, quizCastSess = '';
    let sessionIdType = 'uuid';

    if (hasAttemptSessions) {
      const sessHasUser   = await tableHasColumn('attempt_sessions', 'user_id');
      const sessHasSubId  = await tableHasColumn('attempt_sessions', 'subject_id');
      const sessHasQuiz   = await tableHasColumn('attempt_sessions', 'quiz_id');
      const sessHasCAt    = await tableHasColumn('attempt_sessions', 'created_at');
      const sessUserType  = sessHasUser  ? await getColumnType('attempt_sessions', 'user_id')   : null;
      const sessSubIdType = sessHasSubId ? await getColumnType('attempt_sessions', 'subject_id'): null;
      const sessQuizType  = sessHasQuiz  ? await getColumnType('attempt_sessions', 'quiz_id')   : null;
      const sessQuizNotNull = sessHasQuiz ? await isColumnNotNull('attempt_sessions', 'quiz_id') : false;

      sessionIdType = 'uuid'; // id es uuid

      // castear user para sessions
      let userIdForSess = userId;
      if (sessHasUser && sessUserType === 'uuid' && typeof userIdForSess === 'number') {
        userIdForSess = String(userIdForSess);
      }
      const userCastSess = sessHasUser
        ? (sessUserType === 'uuid' ? '::uuid' : (sessUserType === 'integer' ? '::int' : ''))
        : '';

      let subjectCastSess = '';
      if (sessHasSubId) {
        subjectCastSess = sessSubIdType === 'uuid' ? '::uuid' : (sessSubIdType === 'integer' ? '::int' : '');
      }

      if (sessHasQuiz) {
        quizCastSess = sessQuizType === 'uuid' ? '::uuid' : (sessQuizType === 'integer' ? '::int' : '');
        quizIdForSess = await getQuizIdBySlug(subjectSlug, sessQuizType || 'uuid');
        if (sessQuizNotNull && (quizIdForSess === null || typeof quizIdForSess === 'undefined')) {
          return res.status(500).json({
            error: `attempt_sessions.quiz_id es NOT NULL y no se resolvió. Define QUIZ_${subjectSlug.toUpperCase()}_ID o crea quizzes.slug.`,
          });
        }
      }

      if (!effectiveSession) {
        // crear nueva sesión
        const cols = ['id'];
        const vals = ['gen_random_uuid()'];
        const params = [];

        if (sessHasUser)   { cols.push('user_id');   vals.push(`$${params.push(userIdForSess)}${userCastSess}`); }
        if (sessHasSubId)  { cols.push('subject_id');vals.push(`$${params.push(subj.id)}${subjectCastSess}`); }
        if (sessHasQuiz) {
          if (quizIdForSess == null) { /* null permitido si no NOT NULL */ }
          else { cols.push('quiz_id'); vals.push(`$${params.push(quizIdForSess)}${quizCastSess}`); }
        }
        if (sessHasCAt) { cols.push('created_at'); vals.push('now()'); }

        const sql = `insert into attempt_sessions (${cols.join(',')}) values (${vals.join(',')}) returning id`;
        const created = await pool.query(sql, params);
        effectiveSession = created.rows[0].id;
      } else {
        // asegurar que exista la sesión
        const cols = ['id'];
        const vals = ['$1::uuid'];
        const params = [effectiveSession];

        if (sessHasUser)   { cols.push('user_id');   vals.push(`$${params.length+1}${userCastSess}`); params.push(userIdForSess); }
        if (sessHasSubId)  { cols.push('subject_id');vals.push(`$${params.length+1}${subjectCastSess}`); params.push(subj.id); }
        if (sessHasQuiz && quizIdForSess != null) {
          cols.push('quiz_id'); vals.push(`$${params.length+1}${quizCastSess}`); params.push(quizIdForSess);
        }
        if (sessHasCAt) { cols.push('created_at'); vals.push('now()'); }

        const sql = `insert into attempt_sessions (${cols.join(',')})
                     values (${vals.join(',')})
                     on conflict (id) do nothing`;
        await pool.query(sql, params);
      }
    }

    // ¿Podemos autocorregir?
    const hasCorrect   = await tableHasColumn('choices', 'correct');
    const hasEsCorrecta= await tableHasColumn('choices', 'es_correcta');
    const canAutoGrade = hasCorrect || hasEsCorrecta;

    await pool.query('BEGIN');

    async function insertOption({ blockId, questionId, choiceId }) {
      const cols = ['id'];
      const vals = ['gen_random_uuid()'];
      const params = [];

      if (hasUserId)      { cols.push('user_id');    vals.push(`$${params.push(userId)}${userCastAttempts}`); }
      if (hasSubjectId)   { cols.push('subject_id'); vals.push(`$${params.push(subj.id)}${subjectCastAttempts}`); }

      cols.push('block_id');     vals.push(`$${params.push(blockId)}::uuid`);
      cols.push('question_id');  vals.push(`$${params.push(questionId)}::uuid`);
      cols.push('choice_id');    vals.push(`$${params.push(choiceId)}::uuid`);
      if (effectiveSession) { cols.push('session_id'); vals.push(`$${params.push(effectiveSession)}::uuid`); }
      cols.push('created_at');   vals.push('now()');

      if (canAutoGrade) {
        cols.push('correct');
        const qp = `$${params.push(questionId)}::uuid`;
        const cp = `$${params.push(choiceId)}::uuid`;
        vals.push(`
          exists (
            select 1
              from choices ch
             where ch.id=${cp}
               and ch.question_id=${qp}
               and (${hasCorrect ? 'ch.correct = true' : 'false'} OR ${hasEsCorrecta ? 'ch.es_correcta = true' : 'false'})
          )
        `);
      }

      const sql = `insert into attempts (${cols.join(',')}) values (${vals.join(',')})`;
      await pool.query(sql, params);
    }

    async function insertOpen({ blockId, questionId, answerText }) {
      const cols = ['id'];
      const vals = ['gen_random_uuid()'];
      const params = [];

      if (hasUserId)      { cols.push('user_id');    vals.push(`$${params.push(userId)}${userCastAttempts}`); }
      if (hasSubjectId)   { cols.push('subject_id'); vals.push(`$${params.push(subj.id)}${subjectCastAttempts}`); }

      cols.push('block_id');     vals.push(`$${params.push(blockId)}::uuid`);
      cols.push('question_id');  vals.push(`$${params.push(questionId)}::uuid`);
      cols.push('answer_text');  vals.push(`$${params.push(answerText || '')}`);
      if (effectiveSession) { cols.push('session_id'); vals.push(`$${params.push(effectiveSession)}::uuid`); }
      cols.push('created_at');   vals.push('now()');

      const sql = `insert into attempts (${cols.join(',')}) values (${vals.join(',')})`;
      await pool.query(sql, params);
    }

    for (const r of respuestas) {
      if (r.type === 'opcion') {
        await insertOption({ blockId: r.blockId, questionId: r.questionId, choiceId: r.choiceId });
      } else if (r.type === 'abierta') {
        await insertOpen({ blockId: r.blockId, questionId: r.questionId, answerText: r.answerText });
      }
    }

    await pool.query('COMMIT');
    res.json({ ok: true, saved: respuestas.length, sessionId: effectiveSession });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('[ATTEMPTS generic] error:', err);
    res.status(500).json({ error: 'No se pudieron guardar los intentos' });
  }
});

/* =========================================================
   GET /api/:subject/route/summary  (protegido)
   ========================================================= */

router.get('/route/summary', authenticate, async (req, res) => {
  const subjectSlug = req.params.subject;

  let userId = req.user?.sub ?? req.user?.id ?? null;
  if (!userId) return res.status(401).json({ error: 'No autenticado' });
  if (typeof userId === 'string') {
    const n = parseInt(userId, 10);
    if (!Number.isFinite(n)) return res.status(400).json({ error: 'user_id inválido' });
    userId = n;
  }

  try {
    const subj = await getSubjectIdBySlug(subjectSlug);
    if (!subj) return res.status(404).json({ error: `Materia no encontrada: ${subjectSlug}` });

    const quizType = await getColumnType('attempt_sessions', 'quiz_id');
    const quizId = await getQuizIdBySlug(subjectSlug, quizType || 'uuid');
    if (!quizId) return res.status(500).json({ error: 'No se pudo resolver quiz_id (defínelo por ENV o slug en quizzes).' });

    const orderExpr = await pickSessionOrderExpr();

    // última sesión del usuario para ese quiz
    const r = await pool.query(
      `select id
         from attempt_sessions
        where user_id=$1::int and quiz_id=$2::uuid
        order by ${orderExpr} desc nulls last
        limit 1`,
      [userId, quizId]
    );
    if (!r.rowCount) return res.json({ sessionId: null, blocks: [] });

    const sessionId = r.rows[0].id;

    // Agregación por bloque (con metadatos del bloque)
    const { rows } = await pool.query(
      `
      with last_attempt as (
        select distinct on (a.question_id)
               a.question_id,
               a.block_id,
               a.correct,
               a.created_at
          from attempts a
          join questions q on q.id = a.question_id
         where a.session_id = $1::uuid
           and q.tipo = 'opcion'
         order by a.question_id, a.created_at desc
      ),
      agg as (
        select la.block_id,
               count(*)                                   as total_option,
               count(*) filter (where la.correct)         as correct_option
          from last_attempt la
         group by la.block_id
      )
      select
        b.id                               as block_id,
        b.titulo                           as block_title,
        b.code                             as block_code,
        b.orden                            as block_order,
        coalesce(a.total_option, 0)        as total_option,
        coalesce(a.correct_option, 0)      as correct_option,
        0                                  as total_open
      from blocks b
      left join agg a on a.block_id = b.id
      where b.subject_id = $2::uuid
      order by b.orden asc, b.code asc, b.titulo asc
      `,
      [sessionId, subj.id]
    );

    return res.json({ sessionId, blocks: rows });
  } catch (err) {
    console.error('[ROUTE SUMMARY generic] error:', err);
    if (res.headersSent || res.writableEnded) return;
    return res.status(500).json({ error: 'No se pudo generar el resumen' });
  }
});


/* =========================================================
   GET /api/:subject/results/me  (protegido)
   ========================================================= */
router.get('/results/me', authenticate, async (req, res) => {
  const subjectSlug = req.params.subject;

  let userId = req.user?.sub ?? req.user?.id ?? null;
  if (!userId) return res.status(401).json({ error: 'No autenticado' });
  if (typeof userId === 'string') {
    const n = parseInt(userId, 10);
    if (!Number.isFinite(n)) return res.status(400).json({ error: 'user_id inválido' });
    userId = n;
  }

  try {
    const subj = await getSubjectIdBySlug(subjectSlug);
    if (!subj) return res.status(404).json({ error: `Materia no encontrada: ${subjectSlug}` });

    const quizType = await getColumnType('attempt_sessions', 'quiz_id');
    const quizId = await getQuizIdBySlug(subjectSlug, quizType || 'uuid');
    if (!quizId) return res.status(500).json({ error: 'No se pudo resolver quiz_id (ENV o slug).' });

    const orderExpr = await pickSessionOrderExpr();

    const r = await pool.query(
      `select id
         from attempt_sessions
        where user_id=$1::int and quiz_id=$2::uuid
        order by ${orderExpr} desc nulls last
        limit 1`,
      [userId, quizId]
    );
    if (!r.rowCount) return res.json({ sessionId: null, totals: { total:0, correct:0, pct:0 }, byDifficulty: [] });
    const sessionId = r.rows[0].id;

    // Totales usando último intento por pregunta (tipo opción)
    const agg = await pool.query(
      `
      with last_attempt as (
        select distinct on (a.question_id)
               a.question_id,
               a.correct,
               a.created_at
          from attempts a
          join questions q on q.id = a.question_id
         where a.session_id = $1::uuid
           and q.tipo = 'opcion'
         order by a.question_id, a.created_at desc
      )
      select
        count(*)                        as total_option,
        count(*) filter (where correct) as correct_option
      from last_attempt
      `,
      [sessionId]
    );

    const row = agg.rows[0] || {};
    const total = Number(row.total_option || 0);
    const correct = Number(row.correct_option || 0);
    const pct = total ? Math.round((correct / total) * 100) : 0;

    // Por dificultad (opcional)
    let byDifficulty = [];
    try {
      const bd = await pool.query(
        `
        with last_attempt as (
          select distinct on (a.question_id)
                 a.question_id,
                 a.correct,
                 a.created_at
            from attempts a
            join questions q on q.id = a.question_id
           where a.session_id = $1::uuid
             and q.tipo = 'opcion'
           order by a.question_id, a.created_at desc
        )
        select
          q.dificultad,
          count(*)                                        as total,
          count(*) filter (where la.correct)              as correctas,
          case when count(*) = 0 then 0
               else round(100.0 * count(*) filter (where la.correct) / count(*), 2)
          end as porcentaje
        from last_attempt la
        join questions q on q.id = la.question_id
        group by q.dificultad
        order by q.dificultad
        `,
        [sessionId]
      );
      byDifficulty = bd.rows;
    } catch {}

    return res.json({ sessionId, totals: { total, correct, pct }, byDifficulty });
  } catch (err) {
    console.error('[RESULTS /me generic] error:', err);
    res.status(500).json({ error: 'No se pudieron obtener resultados' });
  }
});

/* =========================================================
   GET /api/:subject/route/recommendations  (protegido)
   Usa BLOQUES como "temas": ordena por debilidad (precisión asc)
   ========================================================= */
router.get('/route/recommendations', authenticate, async (req, res) => {
  const subjectSlug = req.params.subject;
  const { sessionId } = req.query;

  let userId = req.user?.sub ?? req.user?.id ?? null;
  if (!userId) return res.status(401).json({ error: 'No autenticado' });
  if (typeof userId === 'string') {
    const n = parseInt(userId, 10);
    if (!Number.isFinite(n)) return res.status(400).json({ error: 'user_id inválido' });
    userId = n;
  }

  try {
    const subj = await getSubjectIdBySlug(subjectSlug);
    if (!subj) return res.status(404).json({ error: `Materia no encontrada: ${subjectSlug}` });

    // Resolver session (última del usuario para este quiz)
    let effectiveSession = sessionId || null;
    if (!effectiveSession) {
      const quizType = await getColumnType('attempt_sessions', 'quiz_id');
      const quizId = await getQuizIdBySlug(subjectSlug, quizType || 'uuid');
      if (!quizId) return res.status(500).json({ error: 'No se pudo resolver quiz_id (ENV o slug en quizzes).' });
      const orderExpr = await pickSessionOrderExpr();
      const r = await pool.query(
        `select id
           from attempt_sessions
          where user_id=$1::int and quiz_id=$2::uuid
          order by ${orderExpr} desc nulls last
          limit 1`,
        [userId, quizId]
      );
      if (!r.rowCount) return res.json({ topics: [] });
      effectiveSession = r.rows[0].id;
    }

    // Precisión por BLOQUE (último intento de cada pregunta tipo opción)
    const q = `
      with last_attempt as (
        select distinct on (a.question_id)
               a.question_id, a.block_id, a.correct, a.created_at
          from attempts a
          join questions q on q.id = a.question_id
         where a.session_id = $1::uuid
           and q.tipo = 'opcion'
         order by a.question_id, a.created_at desc
      ),
      agg as (
        select b.id as block_id,
               b.titulo as block_title,
               count(la.question_id)                              as total,
               count(la.question_id) filter (where la.correct)    as correctas
          from blocks b
          left join questions q on q.block_id = b.id
          left join last_attempt la on la.question_id = q.id
         where b.subject_id = $2::uuid
         group by b.id, b.titulo
      )
      select
        a.block_id    as topic_id,
        a.block_title as topic_name,
        case when a.total = 0 then 0 else round(100.0 * a.correctas / a.total)::int end as accuracy,
        10 as est_time_min,
        coalesce(
          (select json_agg(json_build_object('title', br.title, 'url', br.url) order by br.rank)
             from block_resources br
            where br.block_id = a.block_id),
          '[]'::json
        ) as suggested_readings
      from agg a
      order by (case when a.total=0 then 101 else round(100.0 * a.correctas / a.total)::int end) asc,
               a.block_title asc;
    `;
    const { rows } = await pool.query(q, [effectiveSession, subj.id]);

    res.json({ topics: rows });
  } catch (err) {
    console.error('[ROUTE RECOMMENDATIONS via blocks] error:', err);
    res.status(500).json({ error: 'No se pudieron cargar recomendaciones' });
  }
});

/* =========================================================
   GET /api/:subject/route/block/:blockId  (protegido)
   Desglose por PREGUNTA del bloque (para UI de detalle)
   ========================================================= */
router.get('/route/block/:blockId', authenticate, async (req, res) => {
  const subjectSlug = req.params.subject;
  const { blockId } = req.params;
  const { sessionId } = req.query;

  let userId = req.user?.sub ?? req.user?.id ?? null;
  if (!userId) return res.status(401).json({ error: 'No autenticado' });
  if (typeof userId === 'string') {
    const n = parseInt(userId, 10);
    if (!Number.isFinite(n)) return res.status(400).json({ error: 'user_id inválido' });
    userId = n;
  }

  try {
    const subj = await getSubjectIdBySlug(subjectSlug);
    if (!subj) return res.status(404).json({ error: `Materia no encontrada: ${subjectSlug}` });

    // session efectiva
    let effectiveSession = sessionId || null;
    if (!effectiveSession) {
      const quizType = await getColumnType('attempt_sessions', 'quiz_id');
      const quizId = await getQuizIdBySlug(subjectSlug, quizType || 'uuid');
      if (!quizId) return res.status(500).json({ error: 'No se pudo resolver quiz_id (ENV o slug).' });
      const orderExpr = await pickSessionOrderExpr();
      const r = await pool.query(
        `select id
           from attempt_sessions
          where user_id=$1::int and quiz_id=$2::uuid
          order by ${orderExpr} desc nulls last
          limit 1`,
        [userId, quizId]
      );
      if (!r.rowCount) return res.json({ topics: [] });
      effectiveSession = r.rows[0].id;
    }

    // Desglose por pregunta dentro del bloque
    const q = `
      with last_attempt as (
        select distinct on (a.question_id)
               a.question_id, a.correct, a.created_at
          from attempts a
          join questions q on q.id = a.question_id
         where a.session_id = $1::uuid
           and q.tipo = 'opcion'
         order by a.question_id, a.created_at desc
      )
      select
        q.id   as topic_id,   -- usamos id de pregunta como "topic_id"
        ('Pregunta • ' || left(regexp_replace(q.enunciado, '\\s+', ' ', 'g'), 60)) as topic_name,
        count(la.question_id) filter (where la.correct) as correct,
        count(la.question_id)                           as total
      from questions q
      left join last_attempt la on la.question_id = q.id
      where q.block_id = $2::uuid
      group by q.id, q.enunciado
      order by total asc, topic_name asc;
    `;
    const { rows } = await pool.query(q, [effectiveSession, blockId]);
    res.json({ topics: rows });
  } catch (err) {
    console.error('[ROUTE BLOCK detail via questions] error:', err);
    res.status(500).json({ error: 'No se pudo cargar el detalle del bloque' });
  }
});

/* =========================================================
   POST /api/:subject/route/practice  (protegido)
   Body: { sessionId, topics: [uuid], count: 10 }
   Acepta tanto question_id (desde detalle) como block_id (desde recomendaciones).
   ========================================================= */
router.post('/route/practice', authenticate, async (req, res) => {
  const subjectSlug = req.params.subject;
  const { sessionId, topics = [], count = 10 } = req.body;

  let userId = req.user?.sub ?? req.user?.id ?? null;
  if (!userId) return res.status(401).json({ error: 'No autenticado' });
  if (typeof userId === 'string') {
    const n = parseInt(userId, 10);
    if (!Number.isFinite(n)) return res.status(400).json({ error: 'user_id inválido' });
    userId = n;
  }

  try {
    const subj = await getSubjectIdBySlug(subjectSlug);
    if (!subj) return res.status(404).json({ error: `Materia no encontrada: ${subjectSlug}` });

    // Resolver quizId real (attempt_sessions.quiz_id es NOT NULL en tu esquema)
    const quizId = await getQuizIdBySlug(subjectSlug, 'uuid');
    if (!quizId) {
      return res.status(500).json({ error: `No se pudo resolver quiz_id para ${subjectSlug}. Define QUIZ_${subjectSlug.toUpperCase()}_ID o usa quizzes.slug.` });
    }

    // Heurística: ¿topics son questions o blocks?
    let questionRows;
    if (topics?.length) {
      const chkQ = await pool.query(
        `select id from questions where id = any($1::uuid[]) limit 1`,
        [topics]
      );
      if (chkQ.rowCount > 0) {
        // topics son question_id
        questionRows = await pool.query(
          `select id from questions where id = any($1::uuid[]) order by random() limit $2::int`,
          [topics, count]
        );
      } else {
        // topics son block_id
        questionRows = await pool.query(
          `select q.id
             from questions q
            where q.block_id = any($1::uuid[])
            order by q.dificultad asc nulls last, random()
            limit $2::int`,
          [topics, count]
        );
      }
    } else {
      // sin filtro: preguntas del subject completo
      questionRows = await pool.query(
        `select q.id
           from questions q
          where q.block_id in (select id from blocks where subject_id = $1::uuid)
          order by q.dificultad asc nulls last, random()
          limit $2::int`,
        [subj.id, count]
      );
    }

    // Crear sesión de práctica válida (con quiz_id real)
    const created = await pool.query(
      `insert into attempt_sessions (id, quiz_id, user_id, started_at)
       values (gen_random_uuid(), $1::uuid, $2::int, now())
       returning id`,
      [quizId, userId]
    );
    const practiceSessionId = created.rows[0].id;

    // devolver URL con los ids incluidos
    const idsCsv = (questionRows.rows || []).map(r => r.id).join(',');
    const quizPath = `/practice/${subjectSlug}?sid=${practiceSessionId}&q=${idsCsv}`;

    res.json({
      practiceSessionId,
      questionIds: questionRows.rows.map(r => r.id),
      quizPath
    });
  } catch (err) {
    console.error('[ROUTE PRACTICE mixed ids] error:', err);
    res.status(500).json({ error: 'No se pudo iniciar la práctica' });
  }
});

/* =========================================================
   POST /api/:subject/route/schedule  (protegido)
   Body: { sessionId, topicId, plan }
   Interpreta topicId como block_id (repasos por BLOQUE)
   ========================================================= */
router.post('/route/schedule', authenticate, async (req, res) => {
  const { topicId: blockId, plan = 'sr-2-7-16' } = req.body;

  let userId = req.user?.sub ?? req.user?.id ?? null;
  if (!userId) return res.status(401).json({ error: 'No autenticado' });
  if (typeof userId === 'string') {
    const n = parseInt(userId, 10);
    if (!Number.isFinite(n)) return res.status(400).json({ error: 'user_id inválido' });
    userId = n;
  }

  try {
    await pool.query(
      `insert into schedules (id, user_id, block_id, plan, created_at)
       values (gen_random_uuid(), $1::int, $2::uuid, $3::text, now())`,
      [userId, blockId, plan]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[ROUTE SCHEDULE by block] error:', err);
    res.status(500).json({ error: 'No se pudo agendar el repaso' });
  }
});

/* =========================================================
   GET /api/:subject/questions  (protegido)
   Query: ids=uuid1,uuid2,...
   Resp: { questions:[...], choices:[...], openKeys:[...] }
   ========================================================= */
router.get('/questions', authenticate, async (req, res) => {
  const subjectSlug = req.params.subject;
  const idsCsv = String(req.query.ids || '').trim();
  if (!idsCsv) return res.status(400).json({ error: 'Faltan ids' });

  const ids = idsCsv.split(',').map(s => s.trim()).filter(Boolean);
  if (!ids.length) return res.status(400).json({ error: 'Lista de ids vacía' });

  try {
    const subj = await getSubjectIdBySlug(subjectSlug);
    if (!subj) return res.status(404).json({ error: `Materia no encontrada: ${subjectSlug}` });

    // Preguntas (valida que pertenezcan al subject por su block)
    const qs = await pool.query(
      `select q.id, q.block_id, q.enunciado, q.tipo, q.dificultad
         from questions q
        where q.id = any($1::uuid[])
          and q.block_id in (select b.id from blocks b where b.subject_id = $2::uuid)
        order by q.id`,
      [ids, subj.id]
    );
    if (!qs.rowCount) return res.json({ questions: [], choices: [], openKeys: [] });

    const qIds = qs.rows.map(r => r.id);

    const ch = await pool.query(
      `select id, question_id, texto, es_correcta, correct
         from choices
        where question_id = any($1::uuid[])
        order by question_id, id`,
      [qIds]
    );

    let ok = { rows: [] };
    try {
      ok = await pool.query(
        `select id, question_id, palabra
           from open_keys
          where question_id = any($1::uuid[])
          order by question_id, palabra`,
        [qIds]
      );
    } catch {}

    res.json({ questions: qs.rows, choices: ch.rows, openKeys: ok.rows });
  } catch (err) {
    console.error('[GET /questions] error:', err);
    res.status(500).json({ error: 'No se pudieron cargar preguntas' });
  }
});

/* =========================================================
   GET /api/:subject/materials/block/:blockId  (protegido)
   Solo devuelve apuntes relacionados por TAGS con el bloque.
   Fallback a título/descripcion si no hay matches por tags.
   ========================================================= */
router.get('/materials/block/:blockId', authenticate, async (req, res) => {
  const subjectSlug = req.params.subject;
  const { blockId } = req.params;

  let userId = req.user?.sub ?? req.user?.id ?? null;
  if (!userId) return res.status(401).json({ error: 'No autenticado' });
  if (typeof userId === 'string') {
    const n = parseInt(userId, 10);
    if (!Number.isFinite(n)) return res.status(400).json({ error: 'user_id inválido' });
    userId = n;
  }

  try {
    const subj = await getSubjectIdBySlug(subjectSlug);
    if (!subj) return res.status(404).json({ error: `Materia no encontrada: ${subjectSlug}` });

    // Datos del bloque
    const blkq = await pool.query(
      `select id, code, titulo
         from blocks
        where id=$1::uuid and subject_id=$2::uuid
        limit 1`,
      [blockId, subj.id]
    );
    if (!blkq.rowCount) return res.status(404).json({ error: 'Bloque no encontrado' });
    const block = blkq.rows[0];

    // Diagnóstico simple del bloque para tu guía (opcional)
    const diag = await pool.query(
      `
      with last_attempt as (
        select distinct on (a.question_id)
               a.question_id, a.correct, a.created_at
          from attempts a
          join questions q on q.id = a.question_id
         where a.user_id = $1::int
           and q.block_id = $2::uuid
           and q.tipo = 'opcion'
         order by a.question_id, a.created_at desc
      )
      select count(*) as total,
             count(*) filter (where correct) as correctas
      from last_attempt
      `,
      [userId, blockId]
    );
    const total = Number(diag.rows?.[0]?.total || 0);
    const correctas = Number(diag.rows?.[0]?.correctas || 0);
    const accuracy = total ? Math.round((100 * correctas) / total) : 0;

    // -------- 1) MATCH ESTRICTO POR TAGS --------
    // tags es jsonb (array). Buscamos coincidencias exactas con: blockId, code, titulo.
    // Si no hay coincidencias, haremos un fallback más laxo.
    const codeLike = String(block.code || '').trim();
    const titleLike = String(block.titulo || '').trim();

    const apByTags = await pool.query(
      `
      select a.id, a.titulo, a.descripcion, a.autor, a.creado_en,
             a.resource_url, a.file_path, a.file_mime, a.file_size
        from apuntes a
       where a.subject_slug = $1
         and exists (
               select 1
                 from jsonb_array_elements_text(coalesce(a.tags, '[]'::jsonb)) t(val)
                where t.val = $2
                   or ($3 <> '' and t.val ilike $3)
                   or ($4 <> '' and t.val ilike $4)
             )
       order by a.creado_en desc
       limit 50
      `,
      [
        subjectSlug,
        String(block.id),               // $2
        codeLike ? `%${codeLike}%` : '',// $3
        titleLike ? `%${titleLike}%` : ''// $4
      ]
    );

    let apuntes = apByTags.rows;

    // -------- 2) FALLBACK (si no hubo match por tags) --------
    if (apuntes.length === 0) {
      const apFallback = await pool.query(
        `
        select a.id, a.titulo, a.descripcion, a.autor, a.creado_en,
               a.resource_url, a.file_path, a.file_mime, a.file_size
          from apuntes a
         where a.subject_slug = $1
           and (
                ($2 <> '' and (a.titulo ilike $2 or a.descripcion ilike $2 or a.tags::text ilike $2))
             or ($3 <> '' and (a.titulo ilike $3 or a.descripcion ilike $3 or a.tags::text ilike $3))
           )
         order by a.creado_en desc
         limit 30
        `,
        [
          subjectSlug,
          codeLike ? `%${codeLike}%` : '',
          titleLike ? `%${titleLike}%` : ''
        ]
      );
      apuntes = apFallback.rows;
    }

    // Archivos por apunte
    let archivos = [];
    if (apuntes.length) {
      const apIds = apuntes.map(a => a.id);
      const f = await pool.query(
        `select ap.id as apunte_id, af.id, af.filename, af.originalname, af.mimetype, af.size, af.creado_en
           from apunte_archivos af
           join apuntes ap on ap.id = af.apunte_id
          where ap.id = any($1::int[])
          order by ap.id, af.creado_en desc`,
        [apIds]
      );
      archivos = f.rows;
    }

    // Enlaces externos (si tienes esa tabla; si no, queda [] sin fallar)
    let links = [];
    try {
      const lr = await pool.query(
        `select title, url, rank
           from block_resources
          where block_id = $1::uuid
          order by rank nulls last, title`,
        [blockId]
      );
      links = lr.rows;
    } catch { /* tabla opcional */ }

    // Guía sugerida en base al accuracy
    let guide = [];
    if (accuracy < 50) {
      guide = [
        'Lee 1–2 apuntes intro (nivel básico) y toma notas.',
        'Ve un ejemplo guiado y replica el procedimiento.',
        'Practica 3 preguntas fáciles y 2 medias.',
        'Revisa errores y vuelve a intentar 3 preguntas nuevas.'
      ];
    } else if (accuracy < 80) {
      guide = [
        'Lee 1 apunte de repaso (sección de dudas).',
        'Practica 3 preguntas medias y 2 difíciles.',
        'Revisa explicaciones de preguntas falladas.'
      ];
    } else {
      guide = [
        'Practica 5 preguntas difíciles.',
        'Anota atajos/heurísticas que te funcionaron.',
        'Programa repaso espaciado la próxima semana.'
      ];
    }

    return res.json({
      block,
      diagnosis: { total, correctas, accuracy },
      materials: { apuntes, archivos, links },
      guide
    });
  } catch (err) {
    console.error('[GET /materials/block/:blockId] error:', err);
    if (res.headersSent || res.writableEnded) return;
    return res.status(500).json({ error: 'No se pudieron cargar materiales' });
  }
});




module.exports = router;
