const activityService = require("../services/activityService");

async function create(req, res, next) {
  try {
    const activity = await activityService.createActivity({
      ...req.body,
      teacher_id: req.user.id,
    });

    return res.status(201).json(activity);
  } catch (error) {
    return next(error);
  }
}

async function list(req, res, next) {
  try {
    const activities = await activityService.listActivities();

    return res.json(activities);
  } catch (error) {
    return next(error);
  }
}

async function listMine(req, res, next) {
  try {
    const activities = await activityService.listStudentActivities(req.user.id);

    return res.json(activities);
  } catch (error) {
    return next(error);
  }
}

async function getMine(req, res, next) {
  try {
    const activity = await activityService.getStudentActivity(req.params.id, req.user.id);

    return res.json(activity);
  } catch (error) {
    return next(error);
  }
}

async function markMineInProgress(req, res, next) {
  try {
    const activity = await activityService.markStudentActivityInProgress(req.params.id, req.user.id);

    return res.json(activity);
  } catch (error) {
    return next(error);
  }
}

async function completeMine(req, res, next) {
  try {
    const activity = await activityService.completeStudentActivity(req.params.id, req.user.id);

    return res.json(activity);
  } catch (error) {
    return next(error);
  }
}

async function listTeacherAssignments(req, res, next) {
  try {
    const activities = await activityService.listTeacherActivityAssignments(req.user.id);

    return res.json(activities);
  } catch (error) {
    return next(error);
  }
}

async function getTeacherAssignment(req, res, next) {
  try {
    const activity = await activityService.getTeacherActivityAssignment(req.params.assignmentId, req.user.id);

    return res.json(activity);
  } catch (error) {
    return next(error);
  }
}

async function reviewTeacherAssignment(req, res, next) {
  try {
    const activity = await activityService.reviewTeacherActivityAssignment(
      req.params.assignmentId,
      req.user.id,
      req.body
    );

    return res.json(activity);
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    const activity = await activityService.updateActivity(req.params.id, {
      ...req.body,
      teacher_id: req.user.id,
    });

    return res.json(activity);
  } catch (error) {
    return next(error);
  }
}

async function remove(req, res, next) {
  try {
    await activityService.deleteActivity(req.params.id);

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  create,
  list,
  listMine,
  getMine,
  markMineInProgress,
  completeMine,
  listTeacherAssignments,
  getTeacherAssignment,
  reviewTeacherAssignment,
  update,
  remove,
};
