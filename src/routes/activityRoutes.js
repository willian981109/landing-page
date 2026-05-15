const { Router } = require("express");

const activityController = require("../controllers/activityController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = Router();
const teacherOnly = [authMiddleware, roleMiddleware(["teacher"])];
const studentOnly = [authMiddleware, roleMiddleware(["student"])];

router.post("/activities", teacherOnly, activityController.create);
router.get("/activities", activityController.list);
router.get("/teacher/activities", teacherOnly, activityController.listTeacherAssignments);
router.get("/teacher/activities/:assignmentId", teacherOnly, activityController.getTeacherAssignment);
router.patch("/teacher/activities/:assignmentId/review", teacherOnly, activityController.reviewTeacherAssignment);
router.get("/my-activities", studentOnly, activityController.listMine);
router.get("/my-activities/:id", studentOnly, activityController.getMine);
router.patch("/my-activities/:id/in-progress", studentOnly, activityController.markMineInProgress);
router.patch("/my-activities/:id/complete", studentOnly, activityController.completeMine);
router.patch("/activities/:id", teacherOnly, activityController.update);
router.delete("/activities/:id", teacherOnly, activityController.remove);

module.exports = router;
