const { Router } = require("express");

const studentController = require("../controllers/studentController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = Router();
const teacherOnly = [authMiddleware, roleMiddleware(["teacher"])];

router.get("/students", teacherOnly, studentController.list);

module.exports = router;
