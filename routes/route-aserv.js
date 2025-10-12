// routes/route-aserv.js
const express = require('express');
const router = express.Router();

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

/* ---------- helpers de dominio (ASERV acepta dos slugs) ---------- */
const SUBJECT_SLUGS_ASERV = ['aserv', 'administracion-servidores'];

/** Devuelve TODOS los subject_id que machan cualquiera de los slugs de ASERV */
async function getSubjectIdsASERV() {
  try {
    const { rows } = await pool.query(
      `select id, slug from subjects where slug = any($1::text[])`,
      [SUBJECT_SLUGS_ASERV]
    );
    return rows.map(r => r.id);
  } catch {
    return [];
  }
}

/** Si defines QUIZ_ASERV_ID en .env, lo usa. Si no, busca por múltiples slugs candidatos. */
async function getQuizIdASERV(expectedType /* 'uuid'|'integer'|'text' */) {
  if (process.env.QUIZ_ASERV_ID?.trim()) {
    const val = process.env.QUIZ_ASERV_ID.trim();
    if (expectedType === 'integer') {
      const n = parseInt(val, 10);
      return Number.isFinite(n) ? n : null;
    }
    return val;
  }
  // Candidatos de slug para quiz (incluye variantes de ambos slugs)
  const QUIZ_SLUGS = [
    'aserv', 'aserv_pre', 'aserv-pre', 'pre-aserv',
    'administracion-servidores', 'administracion-servidores_pre', 'administracion-servidores-pre', 'pre-administracion-servidores',
  ];
  try {
    const r = await pool.query(
      `select id
         from quizzes
        where slug = any($1::text[])
        order by created_at desc nulls last, id asc
        limit 1`,
      [QUIZ_SLUGS]
    );
    if (!r.rowCount) return null;
    const found = r.rows[0].id;
    if (expectedType === 'integer' && typeof found === 'number') return found;
    return found;
  } catch {
    return null;
  }
}

/* =========================================================
   GET /api/aserv/pre-eval  (protegido)
   ========================================================= */
router.get('/pre-eval', authenticate, async (_req, res) => {
  try {
    const subjectIds = await getSubjectIdsASERV(); // puede traer 0, 1 o 2 ids
    let blks;
    if (subjectIds.length) {
      blks = await pool.query(
        `select id, code, titulo, subject_id
           from blocks
          where subject_id = any($1::uuid[])
          order by code asc, titulo asc`,
        [subjectIds]
      );
      console.log(`[ASERV /pre-eval] filtros por subject_id IN, bloques=${blks.rowCount}, subjectIds=${subjectIds.join(',')}`);
    } else {
      // Fallback por prefijo si no hay subjectIds
      blks = await pool.query(
        `select id, code, titulo, subject_id
           from blocks
          where code ilike 'AS%' or code ilike 'ADMIN%'
          order by code asc, titulo asc`
      );
      console.log(`[ASERV /pre-eval] fallback por code ILIKE, bloques=${blks.rowCount}`);
    }

    const blockIds = blks.rows.map(b => b.id);

    let qs = { rows: [] };
    if (blockIds.length) {
      qs = await pool.query(
        `select id, block_id, enunciado, tipo, dificultad
           from questions
          where block_id = any($1::uuid[])
          order by id asc`,
        [blockIds]
      );
    }

    const qIds = qs.rows.map(r => r.id);

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

    let keys = { rows: [] };
    if (qIds.length) {
      try {
        keys = await pool.query(
          `select id, question_id, palabra
             from open_keys
            where question_id = any($1::uuid[])
            order by question_id, palabra`,
          [qIds]
        );
      } catch {}
    }

    // Elegimos un subject “principal” para regresar en payload (el primero si hay)
    const subjectId = subjectIds[0] || null;

    res.json({
      subject: { id: subjectId, slug: 'aserv', nombre: 'Administración de Servidores' },
      blocks: blks.rows,
      questions: qs.rows,
      choices: chs.rows,
      openKeys: keys.rows,
    });
  } catch (err) {
    console.error('[ASERV /pre-eval] error:', err);
    res.status(500).json({ error: 'No se pudo cargar la pre-evaluación' });
  }
});

/* =========================================================
   POST /api/aserv/attempts  (protegido)
   Body: { respuestas:[{ blockId, questionId, type, choiceId?, answerText? }] }
   ========================================================= */
router.post('/attempts', authenticate, async (req, res) => {
  const { respuestas = [] } = req.body;

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

    // subject_id: usa cualquiera de los subjectIds válidos (el primero)
    const subjectIds = await getSubjectIdsASERV();
    const subjectId = subjectIds[0] || null;
    const subjectCastAttempts = hasSubjectId
      ? (subjectColType === 'uuid' ? '::uuid' : (subjectColType === 'integer' ? '::int' : ''))
      : '';

    // attempt_sessions (si existe) + quiz_id
    const hasAttemptSessions = await (async () => {
      try {
        const r = await pool.query(`select to_regclass('public.attempt_sessions') rel`);
        return r.rows[0]?.rel !== null;
      } catch { return false; }
    })();

    let effectiveSession = null;

    if (hasAttemptSessions) {
      const sessHasUser   = await tableHasColumn('attempt_sessions', 'user_id');
      const sessHasSubId  = await tableHasColumn('attempt_sessions', 'subject_id');
      const sessHasQuiz   = await tableHasColumn('attempt_sessions', 'quiz_id');
      const sessHasCAt    = await tableHasColumn('attempt_sessions', 'started_at');

      const sessUserType  = sessHasUser  ? await getColumnType('attempt_sessions', 'user_id')    : null;
      const sessSubIdType = sessHasSubId ? await getColumnType('attempt_sessions', 'subject_id') : null;
      const sessQuizType  = sessHasQuiz  ? await getColumnType('attempt_sessions', 'quiz_id')    : null;
      const sessQuizNotNull = await isColumnNotNull('attempt_sessions', 'quiz_id');

      let userIdForSess = userId;
      if (sessHasUser && sessUserType === 'uuid' && typeof userIdForSess === 'number') {
        userIdForSess = String(userIdForSess);
      }
      const userCastSess = sessHasUser
        ? (sessUserType === 'uuid' ? '::uuid' : (sessUserType === 'integer' ? '::int' : ''))
        : '';

      let subjectIdForSess = null, subjectCastSess = '';
      if (sessHasSubId) {
        subjectIdForSess = subjectId;
        subjectCastSess = sessSubIdType === 'uuid' ? '::uuid' : (sessSubIdType === 'integer' ? '::int' : '');
      }

      let quizIdForSess = null, quizCastSess = '';
      if (sessHasQuiz) {
        const quizType = sessQuizType || 'uuid';
        quizCastSess = quizType === 'uuid' ? '::uuid' : (quizType === 'integer' ? '::int' : '');
        quizIdForSess = await getQuizIdASERV(quizType);
        if (sessQuizNotNull && (quizIdForSess === null || typeof quizIdForSess === 'undefined')) {
          return res.status(500).json({
            error: 'attempt_sessions.quiz_id es NOT NULL y no se resolvió. Define QUIZ_ASERV_ID o crea un quiz con slug aserv/administracion-servidores.',
          });
        }
      }

      // Crear nueva sesión
      {
        const cols = [];
        const vals = [];
        const params = [];

        cols.push('id');         vals.push('gen_random_uuid()');
        if (sessHasUser)   { cols.push('user_id');   vals.push(`$${params.push(userIdForSess)}${userCastSess}`); }
        if (sessHasSubId && subjectIdForSess) {
          cols.push('subject_id'); vals.push(`$${params.push(subjectIdForSess)}${subjectCastSess}`);
        }
        if (sessHasQuiz) {
          if (quizIdForSess == null) { /* null */ }
          else { cols.push('quiz_id'); vals.push(`$${params.push(quizIdForSess)}${quizCastSess}`); }
        }
        if (sessHasCAt) { cols.push('started_at'); vals.push('now()'); }

        const sql = `
          insert into attempt_sessions (${cols.join(',')})
          values (${vals.join(',')})
          returning id
        `;
        const created = await pool.query(sql, params);
        effectiveSession = created.rows[0].id; // UUID
      }
    }

    // autocorrección si choices.correct existe
    const hasCorrectCol = await tableHasColumn('choices', 'correct');
    const canAutoGrade = !!hasCorrectCol;

    await pool.query('BEGIN');

    async function insertOption({ blockId, questionId, choiceId }) {
      const cols = ['id'];
      const vals = ['gen_random_uuid()'];
      const params = [];

      if (await tableHasColumn('attempts', 'user_id')) { cols.push('user_id'); vals.push(`$${params.push(userId)}${userCastAttempts}`); }
      if (await tableHasColumn('attempts', 'subject_id') && subjectId) { cols.push('subject_id'); vals.push(`$${params.push(subjectId)}${subjectCastAttempts}`); }

      cols.push('block_id');     vals.push(`$${params.push(blockId)}::uuid`);
      cols.push('question_id');  vals.push(`$${params.push(questionId)}::uuid`);
      cols.push('choice_id');    vals.push(`$${params.push(choiceId)}::uuid`);
      if (effectiveSession) { cols.push('session_id');  vals.push(`$${params.push(effectiveSession)}::uuid`); }
      cols.push('created_at');   vals.push('now()');

      if (canAutoGrade) {
        cols.push('correct');
        const qp = `$${params.push(questionId)}::uuid`;
        const cp = `$${params.push(choiceId)}::uuid`;
        vals.push(`
          exists (
            select 1 from choices ch
             where ch.id=${cp} and ch.question_id=${qp} and ch.correct=true
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

      if (await tableHasColumn('attempts', 'user_id')) { cols.push('user_id'); vals.push(`$${params.push(userId)}${userCastAttempts}`); }
      if (await tableHasColumn('attempts', 'subject_id') && subjectId) { cols.push('subject_id'); vals.push(`$${params.push(subjectId)}${subjectCastAttempts}`); }

      cols.push('block_id');     vals.push(`$${params.push(blockId)}::uuid`);
      cols.push('question_id');  vals.push(`$${params.push(questionId)}::uuid`);
      cols.push('answer_text');  vals.push(`$${params.push(answerText || '')}`);
      if (effectiveSession) { cols.push('session_id');  vals.push(`$${params.push(effectiveSession)}::uuid`); }
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
    res.json({ ok: true, saved: respuestas.length, sessionId: effectiveSession || null });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('[ASERV /attempts] error:', err);
    res.status(500).json({ error: 'No se pudieron guardar los intentos' });
  }
});

/* =========================================================
   GET /api/aserv/route/summary  (protegido)
   ========================================================= */
router.get('/route/summary', authenticate, async (req, res) => {
  const qSession = req.query.sessionId || null;

  let userId = req.user?.sub ?? req.user?.id ?? null;
  if (!userId) return res.status(401).json({ error: 'No autenticado' });
  if (typeof userId === 'string') {
    const n = parseInt(userId, 10);
    if (!Number.isFinite(n)) return res.status(400).json({ error: 'user_id inválido' });
    userId = n;
  }

  try {
    const quizType = await getColumnType('attempt_sessions', 'quiz_id'); // 'uuid' esperado
    const quizId = await getQuizIdASERV(quizType);
    if (!quizId) return res.status(500).json({ error: 'No se pudo resolver quiz_id (QUIZ_ASERV_ID / slug).' });

    let sessionId = qSession;
    if (!sessionId) {
      const r = await pool.query(
        `select id
           from attempt_sessions
          where user_id=$1::int and quiz_id=$2::uuid
          order by coalesce(finished_at, started_at) desc nulls last
          limit 1`,
        [userId, quizId]
      );
      if (!r.rowCount) return res.json({ sessionId: null, blocks: [] });
      sessionId = r.rows[0].id;
    }

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
        b.id     as block_id,
        b.titulo as block_title,
        b.code   as block_code,
        count(*)                                   as total_option,
        count(*) filter (where la.correct)         as correct_option,
        0                                          as total_open
      from last_attempt la
      join blocks b on b.id = la.block_id
      group by b.id, b.titulo, b.code
      order by b.code, b.titulo
      `,
      [sessionId]
    );

    res.json({ sessionId, blocks: rows });
  } catch (err) {
    console.error('[ASERV /route/summary] error:', err);
    res.status(500).json({ error: 'No se pudo generar el resumen' });
  }
});

/* =========================================================
   GET /api/aserv/results/me  (protegido)
   ========================================================= */
router.get('/results/me', authenticate, async (req, res) => {
  const qSession = req.query.sessionId || null;

  let userId = req.user?.sub ?? req.user?.id ?? null;
  if (!userId) return res.status(401).json({ error: 'No autenticado' });
  if (typeof userId === 'string') {
    const n = parseInt(userId, 10);
    if (!Number.isFinite(n)) return res.status(400).json({ error: 'user_id inválido' });
    userId = n;
  }

  try {
    const quizType = await getColumnType('attempt_sessions', 'quiz_id');
    const quizId = await getQuizIdASERV(quizType);
    if (!quizId) return res.status(500).json({ error: 'No se pudo resolver quiz_id (QUIZ_ASERV_ID / slug).' });

    let sessionId = qSession;
    if (!sessionId) {
      const r = await pool.query(
        `select id
           from attempt_sessions
          where user_id=$1::int and quiz_id=$2::uuid
          order by coalesce(finished_at, started_at) desc nulls last
          limit 1`,
        [userId, quizId]
      );
      if (!r.rowCount) return res.json({ sessionId: null, totals: { total:0, correct:0, pct:0 }, byDifficulty: [] });
      sessionId = r.rows[0].id;
    }

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
    console.error('[ASERV /results/me] error:', err);
    res.status(500).json({ error: 'No se pudieron obtener resultados' });
  }
});

/* =========================================================
   GET /api/aserv/route/resources  (protegido)
   ========================================================= */
router.get('/route/resources', authenticate, async (req, res) => {
  const blockId = req.query.blockId;
  if (!blockId) return res.status(400).json({ error: 'Falta blockId' });

  try {
    const { rows } = await pool.query(
      `
      select r.id, r.block_id, r.title, r.url, r.tipo, r.provider, r.thumb, r.rank
        from block_resources r
       where r.block_id = $1::uuid
         and (r.tipo is distinct from 'video')
       order by coalesce(r.rank, 999), r.title
      `,
      [blockId]
    );
    res.json({ items: rows });
  } catch (err) {
    console.error('[ASERV /route/resources] error:', err);
    res.status(500).json({ error: 'No se pudieron obtener los recursos' });
  }
});

module.exports = router;
