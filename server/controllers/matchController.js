const db = require("../firebase");

/**
 * Calcule un score de compatibilité entre l'utilisateur courant et un candidat.
 * Score max : 100
 *
 * Critères :
 * - Centres d'intérêt en commun  → 40 pts (proportionnel)
 * - Même langue                  → 20 pts
 * - Même pays d'origine          → 20 pts
 * - Même filière d'étude         → 20 pts
 */
function computeScore(currentUser, candidate) {
  let score = 0;

  // Intérêts communs
  const myInterests = new Set(currentUser.interests || []);
  const theirInterests = candidate.interests || [];
  if (myInterests.size > 0 && theirInterests.length > 0) {
    const common = theirInterests.filter((i) => myInterests.has(i)).length;
    const maxPossible = Math.max(myInterests.size, theirInterests.length);
    score += Math.round((common / maxPossible) * 40);
  }

  // Langue
  if (
    currentUser.language &&
    candidate.language &&
    currentUser.language.toLowerCase() === candidate.language.toLowerCase()
  ) {
    score += 20;
  }

  // Pays
  if (
    currentUser.country &&
    candidate.country &&
    currentUser.country.toLowerCase() === candidate.country.toLowerCase()
  ) {
    score += 20;
  }

  // Filière
  if (
    currentUser.major &&
    candidate.major &&
    currentUser.major.toLowerCase() === candidate.major.toLowerCase()
  ) {
    score += 20;
  }

  return score;
}

/**
 * GET /api/match/suggestions
 * Retourne les 10 meilleurs profils compatibles pour l'utilisateur connecté,
 * triés par score décroissant.
 */
exports.getSuggestions = async (req, res) => {
  try {
    const currentDoc = await db.collection("users").doc(req.user.id).get();

    if (!currentDoc.exists) {
      return res.status(404).json({ message: "User not found" });
    }

    const currentUser = currentDoc.data();

    // Récupérer tous les autres utilisateurs
    const snapshot = await db.collection("users").get();

    const suggestions = [];

    snapshot.forEach((doc) => {
      if (doc.id === req.user.id) return; // exclure soi-même

      const candidate = doc.data();
      const score = computeScore(currentUser, candidate);

      suggestions.push({
        id: doc.id,
        name: candidate.name,
        country: candidate.country,
        language: candidate.language,
        major: candidate.major,
        interests: candidate.interests,
        bio: candidate.bio,
        avatar: candidate.avatar,
        role: candidate.role,
        compatibilityScore: score,
      });
    });

    // Trier par score décroissant, garder le top 10
    suggestions.sort((a, b) => b.compatibilityScore - a.compatibilityScore);
    const top10 = suggestions.slice(0, 10);

    res.json({ suggestions: top10 });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/match/mentors
 * Retourne uniquement les mentors compatibles (role === "mentor")
 */
exports.getMentors = async (req, res) => {
  try {
    const currentDoc = await db.collection("users").doc(req.user.id).get();

    if (!currentDoc.exists) {
      return res.status(404).json({ message: "User not found" });
    }

    const currentUser = currentDoc.data();

    const snapshot = await db
      .collection("users")
      .where("role", "==", "mentor")
      .get();

    const mentors = [];

    snapshot.forEach((doc) => {
      if (doc.id === req.user.id) return;

      const candidate = doc.data();
      const score = computeScore(currentUser, candidate);

      mentors.push({
        id: doc.id,
        name: candidate.name,
        country: candidate.country,
        language: candidate.language,
        major: candidate.major,
        interests: candidate.interests,
        bio: candidate.bio,
        avatar: candidate.avatar,
        compatibilityScore: score,
      });
    });

    mentors.sort((a, b) => b.compatibilityScore - a.compatibilityScore);

    res.json({ mentors });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
