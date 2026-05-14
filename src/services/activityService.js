const activityModel = require("../models/activityModel");

function createActivityError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function validateActivityInput({ title, description, deadline, points, teacher_id }) {
  if (!title || !description || !deadline || points === undefined || !teacher_id) {
    throw createActivityError("Title, description, deadline, points and teacher_id are required");
  }

  if (!Number.isInteger(Number(points)) || Number(points) < 0) {
    throw createActivityError("Points must be a non-negative integer");
  }

  if (typeof teacher_id !== "string" || !/^[0-9a-f-]{36}$/i.test(teacher_id)) {
    throw createActivityError("teacher_id must be a valid user id");
  }
}

async function createActivity(payload) {
  validateActivityInput(payload);

  return activityModel.createActivity({
    title: payload.title,
    description: payload.description,
    deadline: payload.deadline,
    points: Number(payload.points),
    teacher_id: payload.teacher_id,
  });
}

async function listActivities() {
  return activityModel.findAllActivities();
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
  updateActivity,
  deleteActivity,
};
