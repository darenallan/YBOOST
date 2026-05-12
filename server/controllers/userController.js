const db = require("../firebase");

/**
 * GET /api/users/me
 * Retourne le profil de l'utilisateur connecté
 */
exports.getMe = async (req, res) => {
  try {
    const doc = await db.collection("users").doc(req.user.id).get();

    if (!doc.exists) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = doc.data();
    delete user.password;

    res.json({ id: doc.id, ...user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/users/:id
 * Retourne le profil public d'un autre utilisateur
 */
exports.getUserById = async (req, res) => {
  try {
    const doc = await db.collection("users").doc(req.params.id).get();

    if (!doc.exists) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = doc.data();
    // On expose uniquement les champs publics
    const publicProfile = {
      id: doc.id,
      name: user.name,
      country: user.country,
      language: user.language,
      major: user.major,
      interests: user.interests,
      bio: user.bio,
      avatar: user.avatar,
      role: user.role,
    };

    res.json(publicProfile);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * PUT /api/users/me
 * Met à jour le profil de l'utilisateur connecté
 * Champs autorisés : name, country, language, major, interests, bio, avatar
 */
exports.updateMe = async (req, res) => {
  try {
    const updates = req.body.updates;
    updates.updatedAt = new Date();

    await db.collection("users").doc(req.user.id).update(updates);

    res.json({ message: "Profile updated", updates });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
