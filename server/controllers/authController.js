const jwt = require("jsonwebtoken");
const db = require("../firebase");
const { hashPassword, comparePassword } = require("../utils/hashPassword");
const generateToken = require("../utils/generateToken");

/**
 * POST /api/auth/register
 */
exports.register = async (req, res) => {
  try {
    const { name, email, password, country, language, major } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "name, email and password are required" });
    }

    const usersRef = db.collection("users");
    const existingUser = await usersRef.where("email", "==", email).get();

    if (!existingUser.empty) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await hashPassword(password);

    const newUser = {
      name,
      email,
      password: hashedPassword,
      country: country || "",
      language: language || "",
      major: major || "",
      interests: [],
      bio: "",
      avatar: "",
      role: "student",
      createdAt: new Date(),
    };

    const docRef = await usersRef.add(newUser);

    const token = generateToken(docRef.id, email);

    // Retourner le profil sans le mot de passe
    const { password: _, ...userWithoutPassword } = newUser;

    res.status(201).json({ token, user: { id: docRef.id, ...userWithoutPassword } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * POST /api/auth/login
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "email and password are required" });
    }

    const usersRef = db.collection("users");
    const userSnapshot = await usersRef.where("email", "==", email).get();

    if (userSnapshot.empty) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const user = userSnapshot.docs[0].data();
    const userId = userSnapshot.docs[0].id;

    const isMatch = await comparePassword(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = generateToken(userId, email);

    const { password: _, ...userWithoutPassword } = user;

    res.json({ token, user: { id: userId, ...userWithoutPassword } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
