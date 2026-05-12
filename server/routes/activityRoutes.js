const express = require("express");
const router = express.Router();
const activityController = require("../controllers/activityController");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

router.get("/recommendations", activityController.getRecommendations);
router.get("/", activityController.getAllActivities);
router.get("/:id", activityController.getActivityById);
router.post("/:id/join", activityController.joinActivity);
router.post("/:id/leave", activityController.leaveActivity);

module.exports = router;
