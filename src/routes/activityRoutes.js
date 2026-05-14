const { Router } = require("express");

const activityController = require("../controllers/activityController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = Router();
const teacherOnly = [authMiddleware, roleMiddleware(["teacher"])];

router.post("/activities", teacherOnly, activityController.create);
router.get("/activities", activityController.list);
router.patch("/activities/:id", teacherOnly, activityController.update);
router.delete("/activities/:id", teacherOnly, activityController.remove);

module.exports = router;
