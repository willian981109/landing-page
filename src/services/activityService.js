const activityModel = require("../models/activityModel");
const studentModel = require("../models/studentModel");

const VALID_MATERIAL_TYPES = ["link", "pdf", "audio", "docs", "video"];

function createActivityError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function isUuid(value) {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
}

function validateActivityInput(
  { title, description, deadline, points, teacher_id, student_id, materials },
  { requireStudent = false } = {}
) {
  if (!title || !description || !deadline || points === undefined || !teacher_id) {
    throw createActivityError("Title, description, deadline, points and teacher_id are required");
  }

  if (!Number.isInteger(Number(points)) || Number(points) < 0) {
    throw createActivityError("Points must be a non-negative integer");
  }

  if (!isUuid(teacher_id)) {
    throw createActivityError("teacher_id must be a valid user id");
  }

  if (requireStudent && !student_id) {
    throw createActivityError("student_id is required");
  }

  if (student_id && !isUuid(student_id)) {
    throw createActivityError("student_id must be a valid user id");
  }

  if (materials !== undefined && !Array.isArray(materials)) {
    throw createActivityError("materials must be an array");
  }

  if (Array.isArray(materials)) {
    materials.forEach((material, index) => {
      if (!material || typeof material !== "object") {
        throw createActivityError(`materials[${index}] must be an object`);
      }

      if (!VALID_MATERIAL_TYPES.includes(material.type)) {
        throw createActivityError(`materials[${index}].type must be link, pdf, audio, docs or video`);
      }

      if (!String(material.title || "").trim() || !String(material.url || "").trim()) {
        throw createActivityError(`materials[${index}] title and url are required`);
      }
    });
  }
}

async function createActivity(payload) {
  const normalizedPayload = {
    ...payload,
    student_id: payload.student_id || payload.studentId,
    materials: Array.isArray(payload.materials) ? payload.materials : [],
  };

  validateActivityInput(normalizedPayload, { requireStudent: true });

  const student = await studentModel.findStudentById(normalizedPayload.student_id);

  if (!student) {
    throw createActivityError("Student not found", 404);
  }

  return activityModel.createActivity({
    title: normalizedPayload.title,
    description: normalizedPayload.description,
    deadline: normalizedPayload.deadline,
    points: Number(normalizedPayload.points),
    teacher_id: normalizedPayload.teacher_id,
    student_id: normalizedPayload.student_id,
    materials: normalizedPayload.materials.map((material) => ({
      type: material.type,
      title: String(material.title).trim(),
      url: String(material.url).trim(),
    })),
  });
}

async function listActivities() {
  return activityModel.findAllActivities();
}

async function listStudentActivities(studentId) {
  if (!isUuid(studentId)) {
    throw createActivityError("student_id must be a valid user id");
  }

  return activityModel.findActivitiesByStudent(studentId);
}

async function getStudentActivity(activityId, studentId) {
  if (!isUuid(activityId) || !isUuid(studentId)) {
    throw createActivityError("activity_id and student_id must be valid ids");
  }

  const activity = await activityModel.findActivityByStudent(activityId, studentId);

  if (!activity) {
    throw createActivityError("Activity not found", 404);
  }

  return activity;
}

async function markStudentActivityInProgress(activityId, studentId) {
  if (!isUuid(activityId) || !isUuid(studentId)) {
    throw createActivityError("activity_id and student_id must be valid ids");
  }

  const currentActivity = await activityModel.findActivityByStudent(activityId, studentId);

  if (!currentActivity) {
    throw createActivityError("Activity not found", 404);
  }

  if (currentActivity.status === "completed") {
    return currentActivity;
  }

  return activityModel.updateStudentActivityStatus(activityId, studentId, "in_progress");
}

async function completeStudentActivity(activityId, studentId) {
  if (!isUuid(activityId) || !isUuid(studentId)) {
    throw createActivityError("activity_id and student_id must be valid ids");
  }

  const activity = await activityModel.updateStudentActivityStatus(activityId, studentId, "completed");

  if (!activity) {
    throw createActivityError("Activity not found", 404);
  }

  return activity;
}

async function updateActivity(id, payload) {
  validateActivityInput({
    ...payload,
    teacher_id: payload.teacher_id,
  });

  const activity = await activityModel.updateActivity(id, {
    title: payload.title,
    description: payload.description,
    deadline: payload.deadline,
    points: Number(payload.points),
  });

  if (!activity) {
    throw createActivityError("Activity not found", 404);
  }

  return activity;
}

async function deleteActivity(id) {
  const activity = await activityModel.deleteActivity(id);

  if (!activity) {
    throw createActivityError("Activity not found", 404);
  }

  return activity;
}

module.exports = {
  createActivity,
  listActivities,
  listStudentActivities,
  getStudentActivity,
  markStudentActivityInProgress,
  completeStudentActivity,
  updateActivity,
  deleteActivity,
};
