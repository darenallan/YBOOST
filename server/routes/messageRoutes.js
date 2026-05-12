const express = require("express");
const router = express.Router();
const messageController = require("../controllers/messageController");
const authMiddleware = require("../middleware/authMiddleware");
const { validateMessage } = require("../middleware/validation");

router.use(authMiddleware);

// Conversations
router.get("/conversations", messageController.getMyConversations);
router.post("/conversations", messageController.getOrCreateConversation);

// Messages dans une conversation
router.get("/conversations/:conversationId", messageController.getMessages);
router.post("/conversations/:conversationId", validateMessage, messageController.sendMessage);

module.exports = router;
