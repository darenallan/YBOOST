const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const authMiddleware = require("../middleware/authMiddleware");
const { validateProfileUpdate } = require("../middleware/validation");

// Toutes les routes nécessitent une authentification
router.use(authMiddleware);

router.get("/me", userController.getMe);
router.put("/me", validateProfileUpdate, userController.updateMe);
router.get("/:id", userController.getUserById);

module.exports = router;
