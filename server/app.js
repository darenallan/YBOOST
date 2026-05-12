const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const { generalLimiter, authLimiter, aiLimiter, messageLimiter } = require("./middleware/rateLimit");
const errorMiddleware = require("./middleware/errorMiddleware");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const matchRoutes = require("./routes/matchRoutes");
const messageRoutes = require("./routes/messageRoutes");
const aiRoutes = require("./routes/aiRoutes");
const activityRoutes = require("./routes/activityRoutes");

const app = express();

/* =======================
   MIDDLEWARE
======================= */

// Sécurité HTTP avec Helmet
app.use(helmet());

app.use(cors({ origin: "*" }));
app.use(express.json());

// Appliquer le rate limiting général
app.use(generalLimiter);

/* =======================
   ROUTES
======================= */

app.get("/", (req, res) => {
  res.json({ message: "API is running 🚀" });
});

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/match", matchRoutes);
app.use("/api/messages", messageLimiter, messageRoutes);
app.use("/api/ai", aiLimiter, aiRoutes);
app.use("/api/activities", activityRoutes);

/* =======================
   ERROR HANDLER GLOBAL
======================= */

app.use(errorMiddleware);

module.exports = app;
