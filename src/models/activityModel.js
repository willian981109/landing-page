const { pool } = require("../database/pool");

async function createActivity({
  title,
  description,
  deadline,
  points,
  teacher_id,
  student_id,
  materials = [],
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
        INSERT INTO activities (title, description, deadline, points, teacher_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, title, description, deadline, points, teacher_id, created_at
      `,
      [title, description, deadline, points, teacher_id]
    );
    const activity = result.rows[0];

    if (student_id) {
      const assignmentResult = await client.query(
        `
          INSERT INTO activity_students (activity_id, student_id)
          VALUES ($1, $2)
          RETURNING
            id,
            activity_id,
            student_id,
            status,
            assigned_at,
            completed_at,
            teacher_feedback,
            teacher_summary,
            teacher_grade,
            teacher_observations,
            reviewed_at
        `,
        [activity.id, student_id]
      );

      activity.assigned_students = [assignmentResult.rows[0]];
    } else {
      activity.assigned_students = [];
    }

    activity.materials = [];

    for (const material of materials) {
      const materialResult = await client.query(
        `
          INSERT INTO activity_materials (activity_id, type, title, url)
          VALUES ($1, $2, $3, $4)
          RETURNING id, activity_id, type, title, url, created_at
        `,
        [activity.id, material.type, material.title, material.url]
      );

      activity.materials.push(materialResult.rows[0]);
    }

    await client.query("COMMIT");

    return activity;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function findAllActivities(teacherId) {
  const result = await pool.query(
    `
      SELECT
        a.id,
        a.title,
        a.description,
        a.deadline,
        a.points,
        a.teacher_id,
        a.created_at,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', ast.id,
                'student_id', ast.student_id,
                'student_name', u.name,
                'status', ast.status,
                'assigned_at', ast.assigned_at,
                'completed_at', ast.completed_at,
                'teacher_feedback', ast.teacher_feedback,
                'teacher_summary', ast.teacher_summary,
                'teacher_grade', ast.teacher_grade,
                'teacher_observations', ast.teacher_observations,
                'reviewed_at', ast.reviewed_at
              )
              ORDER BY ast.assigned_at DESC
            )
            FROM activity_students ast
            INNER JOIN users u ON u.id = ast.student_id
            WHERE ast.activity_id = a.id
          ),
          '[]'
        ) AS assigned_students,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', am.id,
                'type', am.type,
                'title', am.title,
                'url', am.url,
                'created_at', am.created_at
              )
              ORDER BY am.created_at ASC
            )
            FROM activity_materials am
            WHERE am.activity_id = a.id
          ),
          '[]'
        ) AS materials
      FROM activities a
      WHERE a.teacher_id = $1
      ORDER BY a.created_at DESC
    `,
    [teacherId]
  );

  return result.rows;
}

async function findActivitiesByStudent(studentId) {
  const result = await pool.query(
    `
      SELECT
        a.id,
        a.title,
        a.description,
        a.deadline,
        a.points,
        a.teacher_id,
        a.created_at,
        activity_students.status,
        activity_students.assigned_at,
        activity_students.completed_at,
        activity_students.teacher_feedback,
        activity_students.teacher_summary,
        activity_students.teacher_grade,
        activity_students.teacher_observations,
        activity_students.reviewed_at,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', am.id,
                'type', am.type,
                'title', am.title,
                'url', am.url,
                'created_at', am.created_at
              )
              ORDER BY am.created_at ASC
            )
            FROM activity_materials am
            WHERE am.activity_id = a.id
          ),
          '[]'
        ) AS materials
      FROM activity_students
      INNER JOIN activities a ON a.id = activity_students.activity_id
      WHERE activity_students.student_id = $1
      ORDER BY activity_students.assigned_at DESC
    `,
    [studentId]
  );

  return result.rows;
}

async function findActivityByStudent(activityId, studentId) {
  const result = await pool.query(
    `
      SELECT
        a.id,
        a.title,
        a.description,
        a.deadline,
        a.points,
        a.teacher_id,
        a.created_at,
        activity_students.status,
        activity_students.assigned_at,
        activity_students.completed_at,
        activity_students.teacher_feedback,
        activity_students.teacher_summary,
        activity_students.teacher_grade,
        activity_students.teacher_observations,
        activity_students.reviewed_at,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', am.id,
                'type', am.type,
                'title', am.title,
                'url', am.url,
                'created_at', am.created_at
              )
              ORDER BY am.created_at ASC
            )
            FROM activity_materials am
            WHERE am.activity_id = a.id
          ),
          '[]'
        ) AS materials
      FROM activity_students
      INNER JOIN activities a ON a.id = activity_students.activity_id
      WHERE activity_students.activity_id = $1
        AND activity_students.student_id = $2
    `,
    [activityId, studentId]
  );

  return result.rows[0];
}

async function updateStudentActivityStatus(activityId, studentId, status) {
  const completedAtExpression = status === "completed" ? "COALESCE(completed_at, NOW())" : "completed_at";
  const result = await pool.query(
    `
      UPDATE activity_students
      SET
        status = $1,
        completed_at = ${completedAtExpression}
      WHERE activity_id = $2
        AND student_id = $3
        AND ($1 = 'completed' OR status <> 'completed')
      RETURNING activity_id
    `,
    [status, activityId, studentId]
  );

  if (result.rowCount === 0) {
    return findActivityByStudent(activityId, studentId);
  }

  return findActivityByStudent(activityId, studentId);
}

async function findTeacherActivityAssignments(teacherId, studentId = null) {
  const values = [teacherId];
  const studentFilter = studentId ? `AND ast.student_id = $${values.push(studentId)}` : "";

  const result = await pool.query(
    `
      SELECT
        ast.id AS assignment_id,
        ast.activity_id,
        ast.student_id,
        u.name AS student_name,
        u.email AS student_email,
        ast.status,
        ast.assigned_at,
        ast.completed_at,
        ast.teacher_feedback,
        ast.teacher_summary,
        ast.teacher_grade,
        ast.teacher_observations,
        ast.reviewed_at,
        a.title,
        a.description,
        a.deadline,
        a.points,
        a.teacher_id,
        a.created_at,
        COALESCE(
          (
            SELECT COUNT(*)::INTEGER
            FROM activity_materials am
            WHERE am.activity_id = a.id
          ),
          0
        ) AS material_count,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', am.id,
                'type', am.type,
                'title', am.title,
                'url', am.url,
                'created_at', am.created_at
              )
              ORDER BY am.created_at ASC
            )
            FROM activity_materials am
            WHERE am.activity_id = a.id
          ),
          '[]'
        ) AS materials
      FROM activity_students ast
      INNER JOIN activities a ON a.id = ast.activity_id
      INNER JOIN users u ON u.id = ast.student_id
      WHERE a.teacher_id = $1
        ${studentFilter}
      ORDER BY ast.assigned_at DESC
    `,
    values
  );

  return result.rows;
}

async function findTeacherActivityAssignmentById(assignmentId, teacherId) {
  const result = await pool.query(
    `
      SELECT
        ast.id AS assignment_id,
        ast.activity_id,
        ast.student_id,
        u.name AS student_name,
        u.email AS student_email,
        ast.status,
        ast.assigned_at,
        ast.completed_at,
        ast.teacher_feedback,
        ast.teacher_summary,
        ast.teacher_grade,
        ast.teacher_observations,
        ast.reviewed_at,
        a.title,
        a.description,
        a.deadline,
        a.points,
        a.teacher_id,
        a.created_at,
        COALESCE(
          (
            SELECT COUNT(*)::INTEGER
            FROM activity_materials am
            WHERE am.activity_id = a.id
          ),
          0
        ) AS material_count,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', am.id,
                'type', am.type,
                'title', am.title,
                'url', am.url,
                'created_at', am.created_at
              )
              ORDER BY am.created_at ASC
            )
            FROM activity_materials am
            WHERE am.activity_id = a.id
          ),
          '[]'
        ) AS materials
      FROM activity_students ast
      INNER JOIN activities a ON a.id = ast.activity_id
      INNER JOIN users u ON u.id = ast.student_id
      WHERE ast.id = $1
        AND a.teacher_id = $2
    `,
    [assignmentId, teacherId]
  );

  return result.rows[0];
}

async function reviewTeacherActivityAssignment(
  assignmentId,
  teacherId,
  { teacher_feedback, teacher_summary, teacher_grade, teacher_observations }
) {
  const result = await pool.query(
    `
      UPDATE activity_students ast
      SET
        teacher_feedback = $1,
        teacher_summary = $2,
        teacher_grade = $3,
        teacher_observations = $4,
        status = 'reviewed',
        reviewed_at = NOW()
      FROM activities a
      WHERE ast.activity_id = a.id
        AND ast.id = $5
        AND a.teacher_id = $6
      RETURNING ast.id
    `,
    [
      teacher_feedback,
      teacher_summary,
      teacher_grade,
      teacher_observations,
      assignmentId,
      teacherId,
    ]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return findTeacherActivityAssignmentById(assignmentId, teacherId);
}

async function updateActivity(id, teacherId, { title, description, deadline, points }) {
  const result = await pool.query(
    `
      UPDATE activities
      SET
        title = $1,
        description = $2,
        deadline = $3,
        points = $4
      WHERE id = $5
        AND teacher_id = $6
      RETURNING id, title, description, deadline, points, teacher_id, created_at
    `,
    [title, description, deadline, points, id, teacherId]
  );

  return result.rows[0];
}

async function deleteActivity(id, teacherId) {
  const result = await pool.query(
    `
      DELETE FROM activities
      WHERE id = $1
        AND teacher_id = $2
      RETURNING id
    `,
    [id, teacherId]
  );

  return result.rows[0];
}

module.exports = {
  createActivity,
  findAllActivities,
  findActivitiesByStudent,
  findActivityByStudent,
  updateStudentActivityStatus,
  findTeacherActivityAssignments,
  findTeacherActivityAssignmentById,
  reviewTeacherActivityAssignment,
  updateActivity,
  deleteActivity,
};
