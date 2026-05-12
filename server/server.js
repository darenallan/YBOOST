require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");

const app = require("./app");
const db = require("./firebase");
const socketAuth = require("./sockets/socketAuth");

const server = http.createServer(app);

/* =======================
   SOCKET.IO
======================= */

const io = new Server(server, {
  cors: { origin: "*" },
});

// Middleware d'authentification pour Socket.io
io.use(socketAuth);

io.on("connection", (socket) => {
  console.log(`User ${socket.user?.id || 'unknown'} connected:`, socket.id);

  // Rejoindre une conversation
  socket.on("joinRoom", (conversationId) => {
    socket.join(conversationId);
    console.log(`Socket ${socket.id} (user: ${socket.user?.id}) joined room ${conversationId}`);
  });

  // Quitter une conversation
  socket.on("leaveRoom", (conversationId) => {
    socket.leave(conversationId);
  });

  // Envoyer un message — on persiste en Firestore puis on broadcast
  socket.on("sendMessage", async (data) => {
    const { conversationId, message } = data;

    try {
      // Vérifier que l'utilisateur est authentifié et autorisé
      if (!socket.user || !socket.user.id) {
        return socket.emit("messageError", { error: "Unauthorized" });
      }

      // Vérifier que le senderId correspond à l'utilisateur authentifié
      if (message.senderId !== socket.user.id) {
        return socket.emit("messageError", { error: "Unauthorized sender" });
      }

      // Persister le message
      const msgRef = db
        .collection("conversations")
        .doc(conversationId)
        .collection("messages");

      const docRef = await msgRef.add({
        ...message,
        createdAt: new Date(),
      });

      // Mettre à jour le lastMessage de la conversation
      await db.collection("conversations").doc(conversationId).update({
        lastMessage: message.text,
        lastMessageAt: new Date(),
        lastSenderId: message.senderId,
      });

      const savedMessage = { id: docRef.id, ...message, createdAt: new Date() };

      // Broadcast à tous les membres du room
      io.to(conversationId).emit("receiveMessage", savedMessage);
    } catch (error) {
      console.error("Error saving message:", error);
      socket.emit("messageError", { error: "Failed to send message" });
    }
  });

  // Indicateur de frappe
  socket.on("typing", ({ conversationId, userId }) => {
    socket.to(conversationId).emit("typing", { userId });
  });

  socket.on("stopTyping", ({ conversationId, userId }) => {
    socket.to(conversationId).emit("stopTyping", { userId });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

/* =======================
   START SERVER
======================= */

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
