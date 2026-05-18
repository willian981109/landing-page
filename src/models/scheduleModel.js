const { pool } = require("../database/pool");

function buildPendingRequestJson(alias = "scr") {
  return `
    json_build_object(
      'id', ${alias}.id,
      'schedule_id', ${alias}.schedule_id,
      'student_id', ${alias}.student_id,
      'requested_date', ${alias}.requested_date,
      'requested_time', ${alias}.requested_time,
      'reason', ${alias}.reason,
      'previous_schedule_status', ${alias}.previous_schedule_status,
      'status', ${alias}.status,
      'created_at', ${alias}.created_at,
      'reviewed_at', ${alias}.reviewed_at
    )
  `;
}

async function findSchedulesByStudent(studentId) {
  const result = await pool.query(
    `
      SELECT
        cs.id,
        cs.student_id,
        student.name AS student_name,
        cs.teacher_id,
        teacher.name AS teacher_name,
        cs.class_date,
        cs.class_time,
        cs.meet_link,
        cs.notes,
        cs.status,
        cs.created_at,
        (
          SELECT ${buildPendingRequestJson("scr")}
          FROM schedule_change_requests scr
          WHERE scr.schedule_id = cs.id
            AND scr.status = 'pending'
          ORDER BY scr.created_at DESC
          LIMIT 1
        ) AS pending_request
      FROM class_schedules cs
      INNER JOIN users student ON student.id = cs.student_id
      INNER JOIN users teacher ON teacher.id = cs.teacher_id
      WHERE cs.student_id = $1
      ORDER BY cs.class_date ASC, cs.class_time ASC
    `,
    [studentId]
  );

  return result.rows;
}

async function findChangeRequestsByStudent(studentId) {
  const result = await pool.query(
    `
      SELECT
        scr.id,
        scr.schedule_id,
        scr.student_id,
        scr.requested_date,
        scr.requested_time,
        scr.reason,
        scr.previous_schedule_status,
        scr.status,
        scr.created_at,
        scr.reviewed_at,
        cs.class_date AS current_date,
        cs.class_time AS current_time,
        cs.meet_link,
        cs.notes,
        cs.status AS schedule_status
      FROM schedule_change_requests scr
      INNER JOIN class_schedules cs ON cs.id = scr.schedule_id
      WHERE scr.student_id = $1
      ORDER BY scr.created_at DESC
      LIMIT 20
    `,
    [studentId]
  );

  return result.rows;
}

async function findAvailabilityForStudent(studentId) {
  const result = await pool.query(
    `
      SELECT
        ta.id,
        ta.teacher_id,
        teacher.name AS teacher_name,
        ta.available_date,
        ta.available_time,
        ta.created_at
      FROM teacher_availability ta
      INNER JOIN users teacher ON teacher.id = ta.teacher_id
      WHERE ta.teacher_id IN (
        SELECT DISTINCT teacher_id
        FROM class_schedules
        WHERE student_id = $1
      )
      ORDER BY ta.available_date ASC, ta.available_time ASC
    `,
    [studentId]
  );

  return result.rows;
}

async function findScheduleByStudent(scheduleId, studentId) {
  const result = await pool.query(
    `
      SELECT
        cs.id,
        cs.student_id,
        student.name AS student_name,
        cs.teacher_id,
        teacher.name AS teacher_name,
        cs.class_date,
        cs.class_time,
        cs.meet_link,
        cs.notes,
        cs.status,
        cs.created_at
      FROM class_schedules cs
      INNER JOIN users student ON student.id = cs.student_id
      INNER JOIN users teacher ON teacher.id = cs.teacher_id
      WHERE cs.id = $1
        AND cs.student_id = $2
    `,
    [scheduleId, studentId]
  );

  return result.rows[0];
}

async function findScheduleConflict({ teacherId, studentId, classDate, classTime, excludeScheduleId = null }) {
  const values = [classDate, classTime, teacherId, studentId];
  let excludeClause = "";

  if (excludeScheduleId) {
    values.push(excludeScheduleId);
    excludeClause = `AND id <> $${values.length}`;
  }

  const result = await pool.query(
    `
      SELECT id, student_id, teacher_id, class_date, class_time, status
      FROM class_schedules
      WHERE class_date = $1
        AND class_time = $2
        AND status <> 'canceled'
        AND (teacher_id = $3 OR student_id = $4)
        ${excludeClause}
      LIMIT 1
    `,
    values
  );

  return result.rows[0];
}

async function findTeacherAvailability(teacherId) {
  const result = await pool.query(
    `
      SELECT
        id,
        teacher_id,
        available_date,
        available_time,
        created_at
      FROM teacher_availability
      WHERE teacher_id = $1
      ORDER BY available_date ASC, available_time ASC
    `,
    [teacherId]
  );

  return result.rows;
}

async function createTeacherAvailability({ teacherId, availableDate, availableTime }) {
  const result = await pool.query(
    `
      INSERT INTO teacher_availability (teacher_id, available_date, available_time)
      VALUES ($1, $2, $3)
      ON CONFLICT (teacher_id, available_date, available_time)
      DO UPDATE SET available_time = EXCLUDED.available_time
      RETURNING id, teacher_id, available_date, available_time, created_at
    `,
    [teacherId, availableDate, availableTime]
  );

  return result.rows[0];
}

async function createAdminSchedule({ studentId, teacherId, classDate, classTime, meetLink, notes, status }) {
  const result = await pool.query(
    `
      INSERT INTO class_schedules (
        student_id,
        teacher_id,
        class_date,
        class_time,
        meet_link,
        notes,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `,
    [studentId, teacherId, classDate, classTime, meetLink, notes, status]
  );

  return findAdminScheduleById(result.rows[0].id, teacherId);
}

async function createChangeRequest({ scheduleId, studentId, requestedDate, requestedTime, reason }) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const scheduleResult = await client.query(
      `
        SELECT id, status
        FROM class_schedules
        WHERE id = $1
          AND student_id = $2
          AND status NOT IN ('canceled', 'completed')
        FOR UPDATE
      `,
      [scheduleId, studentId]
    );

    if (scheduleResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    const requestResult = await client.query(
      `
        INSERT INTO schedule_change_requests (
          schedule_id,
          student_id,
          requested_date,
          requested_time,
          reason,
          previous_schedule_status
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING
          id,
          schedule_id,
          student_id,
          requested_date,
          requested_time,
          reason,
          previous_schedule_status,
          status,
          created_at,
          reviewed_at
      `,
      [scheduleId, studentId, requestedDate, requestedTime, reason, scheduleResult.rows[0].status]
    );

    await client.query(
      `
        UPDATE class_schedules
        SET status = 'pending_change'
        WHERE id = $1
      `,
      [scheduleId]
    );

    await client.query("COMMIT");

    return requestResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function cancelChangeRequest(requestId, studentId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const requestResult = await client.query(
      `
        UPDATE schedule_change_requests
        SET
          status = 'canceled',
          reviewed_at = NOW()
        WHERE id = $1
          AND student_id = $2
          AND status = 'pending'
        RETURNING
          id,
          schedule_id,
          student_id,
          requested_date,
          requested_time,
          reason,
          previous_schedule_status,
          status,
          created_at,
          reviewed_at
      `,
      [requestId, studentId]
    );

    if (requestResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    const previousStatus = requestResult.rows[0].previous_schedule_status || "scheduled";

    await client.query(
      `
        UPDATE class_schedules
        SET status = $1
        WHERE id = $2
          AND status = 'pending_change'
      `,
      [previousStatus, requestResult.rows[0].schedule_id]
    );

    await client.query("COMMIT");

    return requestResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function findAdminSchedules(teacherId) {
  const result = await pool.query(
    `
      SELECT
        cs.id,
        cs.student_id,
        student.name AS student_name,
        student.email AS student_email,
        cs.teacher_id,
        cs.class_date,
        cs.class_time,
        cs.meet_link,
        cs.notes,
        cs.status,
        cs.created_at,
        (
          SELECT ${buildPendingRequestJson("scr")}
          FROM schedule_change_requests scr
          WHERE scr.schedule_id = cs.id
            AND scr.status = 'pending'
          ORDER BY scr.created_at DESC
          LIMIT 1
        ) AS pending_request
      FROM class_schedules cs
      INNER JOIN users student ON student.id = cs.student_id
      WHERE cs.teacher_id = $1
      ORDER BY cs.class_date ASC, cs.class_time ASC
    `,
    [teacherId]
  );

  return result.rows;
}

async function findAdminChangeRequests(teacherId) {
  const result = await pool.query(
    `
      SELECT
        scr.id,
        scr.schedule_id,
        scr.student_id,
        student.name AS student_name,
        student.email AS student_email,
        scr.requested_date,
        scr.requested_time,
        scr.reason,
        scr.previous_schedule_status,
        scr.status,
        scr.created_at,
        scr.reviewed_at,
        cs.class_date AS current_date,
        cs.class_time AS current_time,
        cs.meet_link,
        cs.notes,
        cs.status AS schedule_status
      FROM schedule_change_requests scr
      INNER JOIN class_schedules cs ON cs.id = scr.schedule_id
      INNER JOIN users student ON student.id = scr.student_id
      WHERE cs.teacher_id = $1
      ORDER BY
        CASE WHEN scr.status = 'pending' THEN 0 ELSE 1 END,
        scr.created_at DESC
    `,
    [teacherId]
  );

  return result.rows;
}

async function findAdminChangeRequestById(requestId, teacherId) {
  const result = await pool.query(
    `
      SELECT
        scr.id,
        scr.schedule_id,
        scr.student_id,
        student.name AS student_name,
        student.email AS student_email,
        scr.requested_date,
        scr.requested_time,
        scr.reason,
        scr.previous_schedule_status,
        scr.status,
        scr.created_at,
        scr.reviewed_at,
        cs.class_date AS current_date,
        cs.class_time AS current_time,
        cs.meet_link,
        cs.notes,
        cs.status AS schedule_status
      FROM schedule_change_requests scr
      INNER JOIN class_schedules cs ON cs.id = scr.schedule_id
      INNER JOIN users student ON student.id = scr.student_id
      WHERE scr.id = $1
        AND cs.teacher_id = $2
    `,
    [requestId, teacherId]
  );

  return result.rows[0];
}

async function approveChangeRequest(requestId, teacherId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const requestResult = await client.query(
      `
        SELECT scr.id, scr.schedule_id, scr.requested_date, scr.requested_time
        FROM schedule_change_requests scr
        INNER JOIN class_schedules cs ON cs.id = scr.schedule_id
        WHERE scr.id = $1
          AND cs.teacher_id = $2
          AND scr.status = 'pending'
        FOR UPDATE
      `,
      [requestId, teacherId]
    );

    if (requestResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    const request = requestResult.rows[0];

    await client.query(
      `
        UPDATE class_schedules
        SET
          class_date = $1,
          class_time = $2,
          status = 'confirmed'
        WHERE id = $3
      `,
      [request.requested_date, request.requested_time, request.schedule_id]
    );

    await client.query(
      `
        UPDATE schedule_change_requests
        SET
          status = 'approved',
          reviewed_at = NOW()
        WHERE id = $1
      `,
      [requestId]
    );

    await client.query("COMMIT");

    return findAdminChangeRequestById(requestId, teacherId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function rejectChangeRequest(requestId, teacherId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const requestResult = await client.query(
      `
        SELECT scr.id, scr.schedule_id, scr.previous_schedule_status
        FROM schedule_change_requests scr
        INNER JOIN class_schedules cs ON cs.id = scr.schedule_id
        WHERE scr.id = $1
          AND cs.teacher_id = $2
          AND scr.status = 'pending'
        FOR UPDATE
      `,
      [requestId, teacherId]
    );

    if (requestResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query(
      `
        UPDATE schedule_change_requests
        SET
          status = 'rejected',
          reviewed_at = NOW()
        WHERE id = $1
      `,
      [requestId]
    );

    const previousStatus = requestResult.rows[0].previous_schedule_status || "scheduled";

    await client.query(
      `
        UPDATE class_schedules
        SET status = $1
        WHERE id = $2
          AND status = 'pending_change'
      `,
      [previousStatus, requestResult.rows[0].schedule_id]
    );

    await client.query("COMMIT");

    return findAdminChangeRequestById(requestId, teacherId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function findAdminScheduleById(scheduleId, teacherId) {
  const result = await pool.query(
    `
      SELECT
        cs.id,
        cs.student_id,
        student.name AS student_name,
        student.email AS student_email,
        cs.teacher_id,
        cs.class_date,
        cs.class_time,
        cs.meet_link,
        cs.notes,
        cs.status,
        cs.created_at
      FROM class_schedules cs
      INNER JOIN users student ON student.id = cs.student_id
      WHERE cs.id = $1
        AND cs.teacher_id = $2
    `,
    [scheduleId, teacherId]
  );

  return result.rows[0];
}

async function updateAdminSchedule(scheduleId, teacherId, schedule) {
  const result = await pool.query(
    `
      UPDATE class_schedules
      SET
        class_date = $1,
        class_time = $2,
        meet_link = $3,
        notes = $4,
        status = $5
      WHERE id = $6
        AND teacher_id = $7
      RETURNING id
    `,
    [
      schedule.class_date,
      schedule.class_time,
      schedule.meet_link,
      schedule.notes,
      schedule.status,
      scheduleId,
      teacherId,
    ]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return findAdminScheduleById(scheduleId, teacherId);
}

async function cancelAdminSchedule(scheduleId, teacherId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
        UPDATE class_schedules
        SET status = 'canceled'
        WHERE id = $1
          AND teacher_id = $2
        RETURNING id
      `,
      [scheduleId, teacherId]
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query(
      `
        UPDATE schedule_change_requests
        SET
          status = 'canceled',
          reviewed_at = NOW()
        WHERE schedule_id = $1
          AND status = 'pending'
      `,
      [scheduleId]
    );

    await client.query("COMMIT");

    return findAdminScheduleById(scheduleId, teacherId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  findSchedulesByStudent,
  findChangeRequestsByStudent,
  findAvailabilityForStudent,
  findScheduleByStudent,
  findScheduleConflict,
  findTeacherAvailability,
  createTeacherAvailability,
  createAdminSchedule,
  createChangeRequest,
  cancelChangeRequest,
  findAdminSchedules,
  findAdminChangeRequests,
  findAdminChangeRequestById,
  approveChangeRequest,
  rejectChangeRequest,
  findAdminScheduleById,
  updateAdminSchedule,
  cancelAdminSchedule,
};
