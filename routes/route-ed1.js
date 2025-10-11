// routes/route-ed1.js
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

/* ---------- helpers de dominio ---------- */
async function getSubjectIdED1() {
  if (process.env.SUBJECT_ED1_ID?.trim()) return process.env.SUBJECT_ED1_ID.trim();
  try {
    const r = await pool.query(`select id from subjects where slug in ('ed1') limit 1`);
    if (r.rowCount) return r.rows[0].id;
  } catch {}
  return null;
}
async function getQuizIdED1(expectedType /* 'uuid' | 'integer' | 'text' */) {
  if (process.env.QUIZ_ED1_ID?.trim()) {
    const val = process.env.QUIZ_ED1_ID.trim();
    if (expectedType === 'integer') {
      const n = parseInt(val, 10);
      return Number.isFinite(n) ? n : null;
    }
    return val; // uuid/text
  }
  try {
    const r = await pool.query(
      `select id from quizzes where slug in ('ed1_pre','ed1-pre','pre-ed1','ed1') order by id limit 1`
    );
    if (!r.rowCount) return null;
    const found = r.rows[0].id;
    if (expectedType === 'integer' && typeof found === 'number') return found;
    return found;
  } catch { return null; }
}

/* =========================================================
   GET /api/ed1/pre-eval  (protegido)
   ========================================================= */
router.get('/pre-eval', authenticate, async (_req, res) => {
  try {
    const blks = await pool.query(
      `select id, code, titulo from blocks order by code asc, titulo asc`
    );
    const qs = await pool.query(
      `select id, block_id, enunciado, tipo from questions order by id asc`
    );
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
      subject: { slug: 'ed1', nombre: 'Estructuras de Datos I' },
      blocks: blks.rows,
      questions: qs.rows,
      choices: chs.rows,
      openKeys: keys.rows,
    });
  } catch (err) {
    console.error('[PRE-EVAL] error:', err);
    res.status(500).json({ error: 'No se pudo cargar la pre-evaluación' });
  }
});

/* =========================================================
   POST /api/ed1/attempts  (protegido)
   Body: { respuestas:[{ blockId, questionId, type, choiceId?, answerText? }] }
   Opcional: sessionId (si no viene, creamos una nueva)
   ========================================================= */
router.post('/attempts', authenticate, async (req, res) => {
  const { sessionId: bodySession, respuestas = [] } = req.body;
  const hdrSession = req.header('x-session-id') || null;
  let effectiveSession = bodySession || hdrSession || null;

  // user_id del JWT (tu tabla usuarios.id es integer)
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

    let subjectId = null;
    let subjectCastAttempts = '';
    if (hasSubjectId) {
      subjectId = await getSubjectIdED1();
      subjectCastAttempts = subjectColType === 'uuid' ? '::uuid' : (subjectColType === 'integer' ? '::int' : '');
      if (!subjectId) {
        return res.status(500).json({
          error: 'No se pudo determinar subject_id. Define SUBJECT_ED1_ID o crea subjects.slug=ed1.',
        });
      }
    }

    // ===== asegurar/crear attempt_sessions =====
    const hasAttemptSessions = await (async () => {
      try {
        const r = await pool.query(`select to_regclass('public.attempt_sessions') rel`);
        return r.rows[0]?.rel !== null;
      } catch { return false; }
    })();

    if (hasAttemptSessions) {
      // columnas reales
      const sessHasUser   = await tableHasColumn('attempt_sessions', 'user_id');
      const sessHasSubId  = await tableHasColumn('attempt_sessions', 'subject_id');
      const sessHasQuiz   = await tableHasColumn('attempt_sessions', 'quiz_id');
      const sessHasCAt    = await tableHasColumn('attempt_sessions', 'started_at');
      const sessUserType  = sessHasUser  ? await getColumnType('attempt_sessions', 'user_id')   : null;
      const sessSubIdType = sessHasSubId ? await getColumnType('attempt_sessions', 'subject_id'): null;
      const sessQuizType  = sessHasQuiz  ? await getColumnType('attempt_sessions', 'quiz_id')   : null;
      const sessQuizNotNull = await isColumnNotNull('attempt_sessions', 'quiz_id');

      // castear user_id para attempt_sessions
      let userIdForSess = userId;
      if (sessHasUser && sessUserType === 'uuid' && typeof userIdForSess === 'number') {
        userIdForSess = String(userIdForSess);
      }
      const userCastSess = sessHasUser
        ? (sessUserType === 'uuid' ? '::uuid' : (sessUserType === 'integer' ? '::int' : ''))
        : '';

      let subjectIdForSess = null, subjectCastSess = '';
      if (sessHasSubId) {
        subjectIdForSess = subjectId || (await getSubjectIdED1());
        subjectCastSess = sessSubIdType === 'uuid' ? '::uuid' : (sessSubIdType === 'integer' ? '::int' : '');
      }

      let quizIdForSess = null, quizCastSess = '';
      if (sessHasQuiz) {
        const quizType = sessQuizType || 'uuid';
        quizCastSess = quizType === 'uuid' ? '::uuid' : (quizType === 'integer' ? '::int' : '');
        quizIdForSess = await getQuizIdED1(quizType);
        if (sessQuizNotNull && (quizIdForSess === null || typeof quizIdForSess === 'undefined')) {
          return res.status(500).json({
            error: 'attempt_sessions.quiz_id es NOT NULL y no se resolvió. Define QUIZ_ED1_ID o slug en quizzes.',
          });
        }
      }

      // Si NO vino sessionId → crear una NUEVA sesión y usar su UUID
      if (!effectiveSession) {
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
      } else {
        // vino sessionId → asegurar que exista fila
        const cols = ['id'];
        const vals = ['$1::uuid'];
        const params = [effectiveSession];

        if (sessHasUser)   { cols.push('user_id');   vals.push(`$${params.length+1}${userCastSess}`); params.push(userIdForSess); }
        if (sessHasSubId && subjectIdForSess) {
          cols.push('subject_id'); vals.push(`$${params.length+1}${subjectCastSess}`); params.push(subjectIdForSess);
        }
        if (sessHasQuiz) {
          if (quizIdForSess == null) { /* nada */ }
          else { cols.push('quiz_id'); vals.push(`$${params.length+1}${quizCastSess}`); params.push(quizIdForSess); }
        }
        if (sessHasCAt) { cols.push('started_at'); vals.push('now()'); }

        const sql = `
          insert into attempt_sessions (${cols.join(',')})
          values (${vals.join(',')})
          on conflict (id) do nothing
        `;
        await pool.query(sql, params);
      }
    }

    // ¿choices.correct existe para autocorrección?
    const hasCorrectCol = await tableHasColumn('choices', 'correct');
    const canAutoGrade = !!hasCorrectCol;

    await pool.query('BEGIN');

    // inserts
    async function insertOption({ blockId, questionId, choiceId }) {
      const cols = ['id'];
      const vals = ['gen_random_uuid()'];
      const params = [];

      if (hasUserId) { cols.push('user_id'); vals.push(`$${params.push(userId)}${userCastAttempts}`); }
      if (hasSubjectId) { cols.push('subject_id'); vals.push(`$${params.push(subjectId)}${subjectCastAttempts}`); }

      cols.push('block_id');     vals.push(`$${params.push(blockId)}::uuid`);
      cols.push('question_id');  vals.push(`$${params.push(questionId)}::uuid`);
      cols.push('choice_id');    vals.push(`$${params.push(choiceId)}::uuid`);
      cols.push('session_id');   vals.push(`$${params.push(effectiveSession)}::uuid`);
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

      if (hasUserId) { cols.push('user_id'); vals.push(`$${params.push(userId)}${userCastAttempts}`); }
      if (hasSubjectId) { cols.push('subject_id'); vals.push(`$${params.push(subjectId)}${subjectCastAttempts}`); }

      cols.push('block_id');     vals.push(`$${params.push(blockId)}::uuid`);
      cols.push('question_id');  vals.push(`$${params.push(questionId)}::uuid`);
      cols.push('answer_text');  vals.push(`$${params.push(answerText || '')}`);
      cols.push('session_id');   vals.push(`$${params.push(effectiveSession)}::uuid`);
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
    console.error('[ATTEMPTS] error:', err);
    res.status(500).json({ error: 'No se pudieron guardar los intentos' });
  }
});

/* =========================================================
   GET /api/ed1/route/summary  (protegido)
   ?sessionId=...  (opcional)
   => incluye block_title y block_code
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
    const quizId = await getQuizIdED1(quizType);
    if (!quizId) return res.status(500).json({ error: 'No se pudo resolver quiz_id (QUIZ_ED1_ID / slug).' });

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

    // Agregamos título y code del bloque
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
        b.id   as block_id,
        b.titulo as block_title,
        b.code as block_code,
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
    console.error('[ROUTE SUMMARY] error:', err);
    res.status(500).json({ error: 'No se pudo generar el resumen' });
  }
});

/* =========================================================
   GET /api/ed1/results/me  (protegido)
   ?sessionId=... (opcional)
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
    const quizId = await getQuizIdED1(quizType);
    if (!quizId) return res.status(500).json({ error: 'No se pudo resolver quiz_id (QUIZ_ED1_ID / slug).' });

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

    // === Cálculo consistente: último intento por pregunta (solo 'opcion') ===
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

    // (opcional) por dificultad usando último intento
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
    console.error('[RESULTS /me] error:', err);
    res.status(500).json({ error: 'No se pudieron obtener resultados' });
  }
});

/* =========================================================
   GET /api/ed1/route/resources  (protegido)
   Devuelve recursos para un bloque (EXCLUYE videos)
   Params: ?blockId=UUID
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
    console.error('[ROUTE RESOURCES] error:', err);
    res.status(500).json({ error: 'No se pudieron obtener los recursos' });
  }
});

module.exports = router;
