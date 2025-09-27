// routes/route-subject.js
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
      `select id from quizzes where slug in ($1, $1||'_pre', 'pre-'||$1, $1||'-pre') order by id limit 1`,
      [slug]
    );
    if (!r.rowCount) return null;
    const found = r.rows[0].id;
    if (expectedType === 'integer' && typeof found === 'number') return found;
    return found;
  } catch { return null; }
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
        `select id, question_id, texto
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

  // user_id del JWT (en tu esquema suele ser integer)
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

      sessionIdType = 'uuid'; // id es uuid en tu modelo

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

    const quizType = await getColumnType('attempt_sessions', 'quiz_id'); // uuid esperado
    const quizId = await getQuizIdBySlug(subjectSlug, quizType || 'uuid');
    if (!quizId) return res.status(500).json({ error: 'No se pudo resolver quiz_id (defínelo por ENV o slug en quizzes).' });

    // última sesión del usuario para ese quiz
    const r = await pool.query(
      `select id
         from attempt_sessions
        where user_id=$1::int and quiz_id=$2::uuid
        order by coalesce(finished_at, started_at, created_at) desc nulls last
        limit 1`,
      [userId, quizId]
    );
    if (!r.rowCount) return res.json({ sessionId: null, blocks: [] });

    const sessionId = r.rows[0].id;

    // Agregación por bloque del último intento por pregunta (tipo opción)
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
      )
      select
        la.block_id,
        count(*)                                   as total_option,
        count(*) filter (where la.correct)         as correct_option,
        0                                          as total_open
      from last_attempt la
      group by la.block_id
      order by la.block_id
      `,
      [sessionId]
    );

    res.json({ sessionId, blocks: rows });
  } catch (err) {
    console.error('[ROUTE SUMMARY generic] error:', err);
    res.status(500).json({ error: 'No se pudo generar el resumen' });
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

    const r = await pool.query(
      `select id
         from attempt_sessions
        where user_id=$1::int and quiz_id=$2::uuid
        order by coalesce(finished_at, started_at, created_at) desc nulls last
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

module.exports = router;
