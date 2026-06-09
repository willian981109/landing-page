const { Router } = require("express");

const uploadedFileController = require("../controllers/uploadedFileController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = Router();
const teacherOnly = [authMiddleware, roleMiddleware(["teacher"])];

router.post("/uploads/sign", teacherOnly, uploadedFileController.signUpload);
router.delete("/uploads/:fileId", teacherOnly, uploadedFileController.cancelUpload);
router.get("/files/:fileId/access", authMiddleware, uploadedFileController.getAccess);

module.exports = router;
