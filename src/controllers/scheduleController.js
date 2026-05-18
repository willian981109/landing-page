const scheduleService = require("../services/scheduleService");

async function getMine(req, res, next) {
  try {
    const schedule = await scheduleService.getMySchedule(req.user.id);

    return res.json(schedule);
  } catch (error) {
    return next(error);
  }
}

async function createChangeRequest(req, res, next) {
  try {
    const request = await scheduleService.createChangeRequest(req.user.id, req.body);

    return res.status(201).json(request);
  } catch (error) {
    return next(error);
  }
}

async function listTeacherAvailability(req, res, next) {
  try {
    const availability = await scheduleService.listTeacherAvailability(req.user.id);

    return res.json(availability);
  } catch (error) {
    return next(error);
  }
}

async function createTeacherAvailability(req, res, next) {
  try {
    const availability = await scheduleService.createTeacherAvailability(req.user.id, req.body);

    return res.status(201).json(availability);
  } catch (error) {
    return next(error);
  }
}

async function createSchedule(req, res, next) {
  try {
    const schedule = await scheduleService.createAdminSchedule(req.user.id, req.body);

    return res.status(201).json(schedule);
  } catch (error) {
    return next(error);
  }
}

async function cancelChangeRequest(req, res, next) {
  try {
    const request = await scheduleService.cancelChangeRequest(req.params.id, req.user.id);

    return res.json(request);
  } catch (error) {
    return next(error);
  }
}

async function getAdminSchedule(req, res, next) {
  try {
    const schedule = await scheduleService.getAdminSchedule(req.user.id);

    return res.json(schedule);
  } catch (error) {
    return next(error);
  }
}

async function getAdminChangeRequests(req, res, next) {
  try {
    const requests = await scheduleService.getAdminChangeRequests(req.user.id);

    return res.json(requests);
  } catch (error) {
    return next(error);
  }
}

async function approveChangeRequest(req, res, next) {
  try {
    const request = await scheduleService.approveChangeRequest(req.params.id, req.user.id);

    return res.json(request);
  } catch (error) {
    return next(error);
  }
}

async function rejectChangeRequest(req, res, next) {
  try {
    const request = await scheduleService.rejectChangeRequest(req.params.id, req.user.id);

    return res.json(request);
  } catch (error) {
    return next(error);
  }
}

async function updateAdminSchedule(req, res, next) {
  try {
    const schedule = await scheduleService.updateAdminSchedule(req.params.id, req.user.id, req.body);

    return res.json(schedule);
  } catch (error) {
    return next(error);
  }
}

async function cancelSchedule(req, res, next) {
  try {
    const schedule = await scheduleService.cancelAdminSchedule(req.params.id, req.user.id);

    return res.json(schedule);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getMine,
  createChangeRequest,
  listTeacherAvailability,
  createTeacherAvailability,
  createSchedule,
  cancelChangeRequest,
  getAdminSchedule,
  getAdminChangeRequests,
  approveChangeRequest,
  rejectChangeRequest,
  updateAdminSchedule,
  cancelSchedule,
};
