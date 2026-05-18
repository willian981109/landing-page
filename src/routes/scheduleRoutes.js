const { Router } = require("express");

const scheduleController = require("../controllers/scheduleController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = Router();
const teacherOnly = [authMiddleware, roleMiddleware(["teacher"])];
const studentOnly = [authMiddleware, roleMiddleware(["student"])];

router.get("/teacher/availability", teacherOnly, scheduleController.listTeacherAvailability);
router.post("/teacher/availability", teacherOnly, scheduleController.createTeacherAvailability);

router.get("/schedule/my", studentOnly, scheduleController.getMine);
router.post("/schedule", teacherOnly, scheduleController.createSchedule);
router.post("/schedule/change-request", studentOnly, scheduleController.createChangeRequest);
router.patch("/schedule/change-request/:id/cancel", studentOnly, scheduleController.cancelChangeRequest);
router.patch("/schedule/change-request/:id/approve", teacherOnly, scheduleController.approveChangeRequest);
router.patch("/schedule/change-request/:id/reject", teacherOnly, scheduleController.rejectChangeRequest);
router.patch("/schedule/:id", teacherOnly, scheduleController.updateAdminSchedule);
router.delete("/schedule/:id", teacherOnly, scheduleController.cancelSchedule);

router.get("/admin/schedule", teacherOnly, scheduleController.getAdminSchedule);
router.get("/admin/change-requests", teacherOnly, scheduleController.getAdminChangeRequests);
router.patch("/admin/change-requests/:id/approve", teacherOnly, scheduleController.approveChangeRequest);
router.patch("/admin/change-requests/:id/reject", teacherOnly, scheduleController.rejectChangeRequest);
router.patch("/admin/schedule/:id", teacherOnly, scheduleController.updateAdminSchedule);

module.exports = router;
