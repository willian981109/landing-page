const scheduleModel = require("../models/scheduleModel");
const studentModel = require("../models/studentModel");

const VALID_SCHEDULE_STATUSES = ["scheduled", "pending_change", "confirmed", "canceled", "completed"];

function createScheduleError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function isUuid(value) {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
}

function isDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isTime(value) {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value);
}

function normalizeTime(value) {
  if (!value) {
    return value;
  }

  return value.length === 5 ? `${value}:00` : value;
}

function normalizeOptionalText(value) {
  if (value === undefined) {
    return undefined;
  }

  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function normalizeDateValue(value) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value ?? "").slice(0, 10);
}

function isScheduleSlotConflict(error) {
  return error.code === "23505" && String(error.constraint || "").startsWith("class_schedules_");
}

function isAllowedScheduleStatusChange(currentStatus, nextStatus) {
  if (currentStatus === nextStatus) {
    return true;
  }

  if (nextStatus === "pending_change") {
    return false;
  }

  if (currentStatus === "pending_change") {
    return nextStatus === "canceled";
  }

  if (currentStatus === "canceled") {
    return false;
  }

  if (currentStatus === "completed") {
    return nextStatus === "canceled";
  }

  return true;
}

async function ensureScheduleSlotAvailable({ teacherId, studentId, classDate, classTime, excludeScheduleId = null }) {
  const conflict = await scheduleModel.findScheduleConflict({
    teacherId,
    studentId,
    classDate,
    classTime,
    excludeScheduleId,
  });

  if (conflict) {
    throw createScheduleError("There is already a class scheduled for this teacher or student at this time", 409);
  }
}

async function getMySchedule(studentId) {
  if (!isUuid(studentId)) {
    throw createScheduleError("student_id must be a valid user id");
  }

  const schedules = await scheduleModel.findSchedulesByStudent(studentId);
  const changeRequests = await scheduleModel.findChangeRequestsByStudent(studentId);
  const availability = await scheduleModel.findAvailabilityForStudent(studentId);

  return {
    schedules,
    change_requests: changeRequests,
    availability,
  };
}

async function listTeacherAvailability(teacherId) {
  if (!isUuid(teacherId)) {
    throw createScheduleError("teacher_id must be a valid user id");
  }

  return scheduleModel.findTeacherAvailability(teacherId);
}

async function createTeacherAvailability(teacherId, payload) {
  const availableDate = payload.available_date ?? payload.availableDate;
  const availableTime = normalizeTime(payload.available_time ?? payload.availableTime);

  if (!isUuid(teacherId)) {
    throw createScheduleError("teacher_id must be a valid user id");
  }

  if (!isDate(availableDate)) {
    throw createScheduleError("available_date must be a valid date");
  }

  if (!isTime(availableTime)) {
    throw createScheduleError("available_time must be a valid time");
  }

  return scheduleModel.createTeacherAvailability({
    teacherId,
    availableDate,
    availableTime,
  });
}

async function createAdminSchedule(teacherId, payload) {
  const studentId = payload.student_id ?? payload.studentId;
  const classDate = payload.class_date ?? payload.classDate;
  const classTime = normalizeTime(payload.class_time ?? payload.classTime);
  const status = payload.status ?? "scheduled";
  const meetLink = normalizeOptionalText(payload.meet_link ?? payload.meetLink);
  const notes = normalizeOptionalText(payload.notes);

  if (!isUuid(teacherId) || !isUuid(studentId)) {
    throw createScheduleError("teacher_id and student_id must be valid ids");
  }

  if (!isDate(classDate)) {
    throw createScheduleError("class_date must be a valid date");
  }

  if (!isTime(classTime)) {
    throw createScheduleError("class_time must be a valid time");
  }

  if (!VALID_SCHEDULE_STATUSES.includes(status) || status === "pending_change") {
    throw createScheduleError("status must be scheduled, confirmed, canceled or completed");
  }

  const student = await studentModel.findStudentById(studentId);

  if (!student) {
    throw createScheduleError("Student not found", 404);
  }

  await ensureScheduleSlotAvailable({ teacherId, studentId, classDate, classTime });

  try {
    return await scheduleModel.createAdminSchedule({
      studentId,
      teacherId,
      classDate,
      classTime,
      meetLink: meetLink === undefined ? null : meetLink,
      notes: notes === undefined ? null : notes,
      status,
    });
  } catch (error) {
    if (isScheduleSlotConflict(error)) {
      throw createScheduleError("There is already a class scheduled for this teacher or student at this time", 409);
    }

    throw error;
  }
}

async function createChangeRequest(studentId, payload) {
  const scheduleId = payload.class_schedule_id ?? payload.classScheduleId ?? payload.schedule_id ?? payload.scheduleId;
  const requestedDate = payload.requested_date ?? payload.requestedDate;
  const requestedTime = normalizeTime(payload.requested_time ?? payload.requestedTime);
  const reason = normalizeOptionalText(payload.reason);

  if (!isUuid(studentId) || !isUuid(scheduleId)) {
    throw createScheduleError("schedule_id and student_id must be valid ids");
  }

  if (!isDate(requestedDate)) {
    throw createScheduleError("requested_date must be a valid date");
  }

  if (!isTime(requestedTime)) {
    throw createScheduleError("requested_time must be a valid time");
  }

  const schedule = await scheduleModel.findScheduleByStudent(scheduleId, studentId);

  if (!schedule) {
    throw createScheduleError("Schedule not found", 404);
  }

  if (schedule.status === "canceled" || schedule.status === "completed") {
    throw createScheduleError("Canceled or completed schedules cannot be changed");
  }

  try {
    const request = await scheduleModel.createChangeRequest({
      scheduleId,
      studentId,
      requestedDate,
      requestedTime,
      reason,
    });

    if (!request) {
      throw createScheduleError("Schedule not found", 404);
    }

    return request;
  } catch (error) {
    if (error.code === "23505") {
      throw createScheduleError("There is already a pending request for this class", 409);
    }

    throw error;
  }
}

async function cancelChangeRequest(requestId, studentId) {
  if (!isUuid(requestId) || !isUuid(studentId)) {
    throw createScheduleError("request_id and student_id must be valid ids");
  }

  const request = await scheduleModel.cancelChangeRequest(requestId, studentId);

  if (!request) {
    throw createScheduleError("Pending change request not found", 404);
  }

  return request;
}

async function getAdminSchedule(teacherId) {
  if (!isUuid(teacherId)) {
    throw createScheduleError("teacher_id must be a valid user id");
  }

  return scheduleModel.findAdminSchedules(teacherId);
}

async function getAdminChangeRequests(teacherId) {
  if (!isUuid(teacherId)) {
    throw createScheduleError("teacher_id must be a valid user id");
  }

  return scheduleModel.findAdminChangeRequests(teacherId);
}

async function approveChangeRequest(requestId, teacherId) {
  if (!isUuid(requestId) || !isUuid(teacherId)) {
    throw createScheduleError("request_id and teacher_id must be valid ids");
  }

  const pendingRequest = await scheduleModel.findAdminChangeRequestById(requestId, teacherId);

  if (!pendingRequest || pendingRequest.status !== "pending") {
    throw createScheduleError("Pending change request not found", 404);
  }

  await ensureScheduleSlotAvailable({
    teacherId,
    studentId: pendingRequest.student_id,
    classDate: normalizeDateValue(pendingRequest.requested_date),
    classTime: normalizeTime(String(pendingRequest.requested_time).slice(0, 8)),
    excludeScheduleId: pendingRequest.schedule_id,
  });

  try {
    const request = await scheduleModel.approveChangeRequest(requestId, teacherId);

    if (!request) {
      throw createScheduleError("Pending change request not found", 404);
    }

    return request;
  } catch (error) {
    if (isScheduleSlotConflict(error)) {
      throw createScheduleError("There is already a class scheduled for this teacher or student at this time", 409);
    }

    throw error;
  }
}

async function rejectChangeRequest(requestId, teacherId) {
  if (!isUuid(requestId) || !isUuid(teacherId)) {
    throw createScheduleError("request_id and teacher_id must be valid ids");
  }

  const request = await scheduleModel.rejectChangeRequest(requestId, teacherId);

  if (!request) {
    throw createScheduleError("Pending change request not found", 404);
  }

  return request;
}

async function updateAdminSchedule(scheduleId, teacherId, payload) {
  if (!isUuid(scheduleId) || !isUuid(teacherId)) {
    throw createScheduleError("schedule_id and teacher_id must be valid ids");
  }

  const currentSchedule = await scheduleModel.findAdminScheduleById(scheduleId, teacherId);

  if (!currentSchedule) {
    throw createScheduleError("Schedule not found", 404);
  }

  const classDate = normalizeDateValue(payload.class_date ?? payload.classDate ?? currentSchedule.class_date);
  const classTime = normalizeTime(payload.class_time ?? payload.classTime ?? currentSchedule.class_time);
  const status = payload.status ?? currentSchedule.status;

  if (!isDate(classDate)) {
    throw createScheduleError("class_date must be a valid date");
  }

  if (!isTime(String(classTime))) {
    throw createScheduleError("class_time must be a valid time");
  }

  if (!VALID_SCHEDULE_STATUSES.includes(status)) {
    throw createScheduleError("status must be scheduled, pending_change, confirmed, canceled or completed");
  }

  if (!isAllowedScheduleStatusChange(currentSchedule.status, status)) {
    throw createScheduleError("Invalid schedule status transition");
  }

  const meetLink = normalizeOptionalText(payload.meet_link ?? payload.meetLink);
  const notes = normalizeOptionalText(payload.notes);

  const normalizedClassDate = String(classDate).slice(0, 10);
  const normalizedClassTime = normalizeTime(String(classTime).slice(0, 8));

  if (status !== "canceled") {
    await ensureScheduleSlotAvailable({
      teacherId,
      studentId: currentSchedule.student_id,
      classDate: normalizedClassDate,
      classTime: normalizedClassTime,
      excludeScheduleId: scheduleId,
    });
  }

  try {
    const updatedSchedule = await scheduleModel.updateAdminSchedule(scheduleId, teacherId, {
      class_date: normalizedClassDate,
      class_time: normalizedClassTime,
      meet_link: meetLink === undefined ? currentSchedule.meet_link : meetLink,
      notes: notes === undefined ? currentSchedule.notes : notes,
      status,
    });

    if (!updatedSchedule) {
      throw createScheduleError("Schedule not found", 404);
    }

    return updatedSchedule;
  } catch (error) {
    if (isScheduleSlotConflict(error)) {
      throw createScheduleError("There is already a class scheduled for this teacher or student at this time", 409);
    }

    throw error;
  }
}

async function cancelAdminSchedule(scheduleId, teacherId) {
  if (!isUuid(scheduleId) || !isUuid(teacherId)) {
    throw createScheduleError("schedule_id and teacher_id must be valid ids");
  }

  const schedule = await scheduleModel.cancelAdminSchedule(scheduleId, teacherId);

  if (!schedule) {
    throw createScheduleError("Schedule not found", 404);
  }

  return schedule;
}

module.exports = {
  getMySchedule,
  listTeacherAvailability,
  createTeacherAvailability,
  createAdminSchedule,
  createChangeRequest,
  cancelChangeRequest,
  getAdminSchedule,
  getAdminChangeRequests,
  approveChangeRequest,
  rejectChangeRequest,
  updateAdminSchedule,
  cancelAdminSchedule,
};
