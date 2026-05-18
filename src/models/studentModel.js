const { pool } = require("../database/pool");

async function findAllStudents() {
  const result = await pool.query(
    `
      SELECT id, name
      FROM users
      WHERE role = 'student'
      ORDER BY name ASC
    `
  );

  return result.rows;
}

async function findStudentById(id) {
  const result = await pool.query(
    `
      SELECT id, name
      FROM users
      WHERE id = $1 AND role = 'student'
    `,
    [id]
  );

  return result.rows[0];
}

async function findFeedbackProfileByStudentId(studentId) {
  const result = await pool.query(
    `
      SELECT
        student_id,
        speaking_rating,
        listening_rating,
        writing_rating,
        reading_rating,
        teacher_comment,
        updated_at
      FROM student_feedback_profiles
      WHERE student_id = $1
    `,
    [studentId]
  );

  return result.rows[0];
}

async function upsertFeedbackProfile(studentId, payload) {
  const result = await pool.query(
    `
      INSERT INTO student_feedback_profiles (
        student_id,
        speaking_rating,
        listening_rating,
        writing_rating,
        reading_rating,
        teacher_comment
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (student_id)
      DO UPDATE SET
        speaking_rating = EXCLUDED.speaking_rating,
        listening_rating = EXCLUDED.listening_rating,
        writing_rating = EXCLUDED.writing_rating,
        reading_rating = EXCLUDED.reading_rating,
        teacher_comment = EXCLUDED.teacher_comment,
        updated_at = NOW()
      RETURNING
        student_id,
        speaking_rating,
        listening_rating,
        writing_rating,
        reading_rating,
        teacher_comment,
        updated_at
    `,
    [
      studentId,
      payload.speaking_rating,
      payload.listening_rating,
      payload.writing_rating,
      payload.reading_rating,
      payload.teacher_comment,
    ]
  );

  return result.rows[0];
}

module.exports = {
  findAllStudents,
  findStudentById,
  findFeedbackProfileByStudentId,
  upsertFeedbackProfile,
};
