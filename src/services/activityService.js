const activityModel = require("../models/activityModel");
const studentModel = require("../models/studentModel");
const uploadedFileService = require("./uploadedFileService");

const VALID_MATERIAL_TYPES = ["link", "pdf", "audio", "docs", "video"];
const VALID_ACTIVITY_STATUSES = ["pending", "in_progress", "completed", "reviewed"];

function createActivityError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function isUuid(value) {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch (error) {
    return false;
  }
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

      const title = String(material.title || "").trim();
      const url = String(material.url || "").trim();
      const uploadedFileId = material.uploaded_file_id ?? material.uploadedFileId;

      if (!title) {
        throw createActivityError(`materials[${index}].title is required`);
      }

      if (Boolean(url) === Boolean(uploadedFileId)) {
        throw createActivityError(
          `materials[${index}] must contain either url or uploaded_file_id`
        );
      }

      if (url && !isHttpUrl(url)) {
        throw createActivityError(`materials[${index}].url must be a valid http or https link`);
      }

      if (uploadedFileId && !isUuid(uploadedFileId)) {
        throw createActivityError(`materials[${index}].uploaded_file_id must be a valid id`);
      }

      if (material.type === "link" && uploadedFileId) {
        throw createActivityError(`materials[${index}] link materials cannot contain a file`);
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

  for (const material of normalizedPayload.materials) {
    const uploadedFileId = material.uploaded_file_id ?? material.uploadedFileId;

    if (uploadedFileId) {
      await uploadedFileService.assertUploadedFileReady(
        uploadedFileId,
        normalizedPayload.teacher_id,
        material.type
      );
    }
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
      url: String(material.url || "").trim() || null,
      uploaded_file_id: material.uploaded_file_id ?? material.uploadedFileId ?? null,
    })),
  });
}

async function listActivities(teacherId) {
  if (!isUuid(teacherId)) {
    throw createActivityError("teacher_id must be a valid user id");
  }

  return activityModel.findAllActivities(teacherId);
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

  if (currentActivity.status !== "pending") {
    return currentActivity;
  }

  return activityModel.updateStudentActivityStatus(activityId, studentId, "in_progress");
}

async function completeStudentActivity(activityId, studentId) {
  if (!isUuid(activityId) || !isUuid(studentId)) {
    throw createActivityError("activity_id and student_id must be valid ids");
  }

  const currentActivity = await activityModel.findActivityByStudent(activityId, studentId);

  if (!currentActivity) {
    throw createActivityError("Activity not found", 404);
  }

  if (currentActivity.status === "completed" || currentActivity.status === "reviewed") {
    return currentActivity;
  }

  return activityModel.updateStudentActivityStatus(activityId, studentId, "completed");
}

async function listTeacherActivityAssignments(teacherId, studentId = null) {
  if (!isUuid(teacherId)) {
    throw createActivityError("teacher_id must be a valid user id");
  }

  if (studentId !== null && !isUuid(studentId)) {
    throw createActivityError("student_id must be a valid user id");
  }

  return activityModel.findTeacherActivityAssignments(teacherId, studentId);
}

async function getTeacherActivityAssignment(assignmentId, teacherId) {
  if (!isUuid(assignmentId) || !isUuid(teacherId)) {
    throw createActivityError("assignment_id and teacher_id must be valid ids");
  }

  const assignment = await activityModel.findTeacherActivityAssignmentById(assignmentId, teacherId);

  if (!assignment) {
    throw createActivityError("Activity assignment not found", 404);
  }

  return assignment;
}

function normalizeReviewPayload(payload) {
  const grade = payload.teacher_grade ?? payload.teacherGrade ?? payload.grade;
  const normalizedGrade = grade === "" || grade === null || grade === undefined ? null : Number(grade);

  if (normalizedGrade !== null && (!Number.isInteger(normalizedGrade) || normalizedGrade < 0)) {
    throw createActivityError("Grade must be a non-negative integer");
  }

  return {
    teacher_feedback: String(payload.teacher_feedback ?? payload.teacherFeedback ?? "").trim() || null,
    teacher_grade: normalizedGrade,
  };
}

async function reviewTeacherActivityAssignment(assignmentId, teacherId, payload) {
  if (!isUuid(assignmentId) || !isUuid(teacherId)) {
    throw createActivityError("assignment_id and teacher_id must be valid ids");
  }

  const currentAssignment = await activityModel.findTeacherActivityAssignmentById(assignmentId, teacherId);

  if (!currentAssignment) {
    throw createActivityError("Activity assignment not found", 404);
  }

  const review = normalizeReviewPayload(payload);
  const assignment = await activityModel.reviewTeacherActivityAssignment(assignmentId, teacherId, review);

  if (!assignment || !VALID_ACTIVITY_STATUSES.includes(assignment.status)) {
    throw createActivityError("Activity assignment not found", 404);
  }

  return assignment;
}

async function updateActivity(id, teacherId, payload) {
  if (!isUuid(id) || !isUuid(teacherId)) {
    throw createActivityError("activity_id and teacher_id must be valid ids");
  }

  validateActivityInput({
    ...payload,
    teacher_id: teacherId,
  });

  const activity = await activityModel.updateActivity(id, teacherId, {
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

async function deleteActivity(id, teacherId) {
  if (!isUuid(id) || !isUuid(teacherId)) {
    throw createActivityError("activity_id and teacher_id must be valid ids");
  }

  const files = await activityModel.findActivityUploadedFiles(id, teacherId);
  const activity = await activityModel.deleteActivity(id, teacherId);

  if (!activity) {
    throw createActivityError("Activity not found", 404);
  }

  await Promise.all(files.map((file) => uploadedFileService.removeDetachedUploadedFile(file)));

  return activity;
}

module.exports = {
  createActivity,
  listActivities,
  listStudentActivities,
  getStudentActivity,
  markStudentActivityInProgress,
  completeStudentActivity,
  listTeacherActivityAssignments,
  getTeacherActivityAssignment,
  reviewTeacherActivityAssignment,
  updateActivity,
  deleteActivity,
};
