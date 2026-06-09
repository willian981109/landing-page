const { pool } = require("../database/pool");

async function createPendingUploadedFile(file) {
  const result = await pool.query(
    `
      INSERT INTO uploaded_files (
        id,
        teacher_id,
        storage_bucket,
        storage_path,
        original_name,
        mime_type,
        size_bytes,
        material_type
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
    [
      file.id,
      file.teacher_id,
      file.storage_bucket,
      file.storage_path,
      file.original_name,
      file.mime_type,
      file.size_bytes,
      file.material_type,
    ]
  );

  return result.rows[0];
}

async function findUploadedFileById(fileId) {
  const result = await pool.query(
    "SELECT * FROM uploaded_files WHERE id = $1",
    [fileId]
  );

  return result.rows[0];
}

async function findTeacherUploadedFile(fileId, teacherId) {
  const result = await pool.query(
    `
      SELECT *
      FROM uploaded_files
      WHERE id = $1
        AND teacher_id = $2
    `,
    [fileId, teacherId]
  );

  return result.rows[0];
}

async function canStudentAccessUploadedFile(fileId, studentId) {
  const result = await pool.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM activity_materials am
        INNER JOIN activity_students ast ON ast.activity_id = am.activity_id
        WHERE am.uploaded_file_id = $1
          AND ast.student_id = $2
        UNION ALL
        SELECT 1
        FROM study_materials sm
        WHERE sm.uploaded_file_id = $1
          AND sm.student_id = $2
      ) AS allowed
    `,
    [fileId, studentId]
  );

  return Boolean(result.rows[0]?.allowed);
}

async function deletePendingUploadedFile(fileId, teacherId) {
  const result = await pool.query(
    `
      DELETE FROM uploaded_files
      WHERE id = $1
        AND teacher_id = $2
        AND status = 'pending'
      RETURNING *
    `,
    [fileId, teacherId]
  );

  return result.rows[0];
}

async function deleteUploadedFileRecord(fileId) {
  const result = await pool.query(
    `
      DELETE FROM uploaded_files
      WHERE id = $1
        AND NOT EXISTS (
          SELECT 1 FROM activity_materials WHERE uploaded_file_id = uploaded_files.id
        )
        AND NOT EXISTS (
          SELECT 1 FROM study_materials WHERE uploaded_file_id = uploaded_files.id
        )
      RETURNING *
    `,
    [fileId]
  );

  return result.rows[0];
}

module.exports = {
  canStudentAccessUploadedFile,
  createPendingUploadedFile,
  deletePendingUploadedFile,
  deleteUploadedFileRecord,
  findTeacherUploadedFile,
  findUploadedFileById,
};
