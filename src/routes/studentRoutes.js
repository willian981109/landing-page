const { Router } = require("express");

const studentController = require("../controllers/studentController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = Router();
const teacherOnly = [authMiddleware, roleMiddleware(["teacher"])];
const studentOnly = [authMiddleware, roleMiddleware(["student"])];

router.get("/students", teacherOnly, studentController.list);
router.get("/students/:studentId/feedback-profile", teacherOnly, studentController.getFeedbackProfile);
router.patch("/students/:studentId/feedback-profile", teacherOnly, studentController.updateFeedbackProfile);
router.get("/my-feedback-profile", studentOnly, studentController.getMyFeedbackProfile);

module.exports = router;
