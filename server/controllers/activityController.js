const db = require("../firebase");

/**
 * Calcule un score de pertinence pour une activité selon les intérêts de l'utilisateur
 * Score max : 100
 *
 * Critères :
 * - Correspondance des centres d'intérêt → 70 pts
 * - Localisation (même pays/ville) → 20 pts
 * - Langue de l'activité → 10 pts
 */
function computeActivityScore(user, activity) {
  let score = 0;

  // Intérêts correspondants
  const userInterests = new Set(user.interests || []);
  const activityTags = activity.tags || [];
  
  if (userInterests.size > 0 && activityTags.length > 0) {
    const matchingTags = activityTags.filter(tag => userInterests.has(tag)).length;
    const maxPossible = Math.max(userInterests.size, activityTags.length);
    score += Math.round((matchingTags / maxPossible) * 70);
  }

  // Localisation
  if (user.country && activity.location && 
      activity.location.toLowerCase().includes(user.country.toLowerCase())) {
    score += 20;
  }

  // Langue
  if (user.language && activity.language && 
      user.language.toLowerCase() === activity.language.toLowerCase()) {
    score += 10;
  }

  return score;
}

/**
 * GET /api/activities/recommendations
 * Retourne les activités recommandées pour l'utilisateur connecté
 */
exports.getRecommendations = async (req, res) => {
  try {
    const currentDoc = await db.collection("users").doc(req.user.id).get();
    
    if (!currentDoc.exists) {
      return res.status(404).json({ message: "User not found" });
    }

    const currentUser = currentDoc.data();

    // Récupérer toutes les activités actives
    const snapshot = await db
      .collection("activities")
      .where("isActive", "==", true)
      .where("endDate", ">=", new Date())
      .get();

    const recommendations = [];

    snapshot.forEach((doc) => {
      const activity = doc.data();
      const score = computeActivityScore(currentUser, activity);

      recommendations.push({
        id: doc.id,
        title: activity.title,
        description: activity.description,
        location: activity.location,
        startDate: activity.startDate,
        endDate: activity.endDate,
        tags: activity.tags,
        language: activity.language,
        type: activity.type, // 'event', 'club', 'activity'
        organizer: activity.organizer,
        maxParticipants: activity.maxParticipants,
        currentParticipants: activity.currentParticipants || 0,
        imageUrl: activity.imageUrl || "",
        relevanceScore: score,
      });
    });

    // Trier par score décroissant, garder le top 20
    recommendations.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const top20 = recommendations.slice(0, 20);

    res.json({ recommendations: top20 });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/activities
 * Liste toutes les activités actives (avec pagination)
 */
exports.getAllActivities = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const type = req.query.type; // 'event', 'club', 'activity'
    const tags = req.query.tags ? req.query.tags.split(',') : [];

    let query = db
      .collection("activities")
      .where("isActive", "==", true)
      .where("endDate", ">=", new Date())
      .orderBy("startDate", "asc");

    if (type) {
      query = query.where("type", "==", type);
    }

    const snapshot = await query.limit(limit).get();
    
    const activities = [];
    snapshot.forEach((doc) => {
      const activity = doc.data();
      
      // Filtrer par tags si spécifiés
      if (tags.length > 0) {
        const activityTags = activity.tags || [];
        const hasMatchingTag = tags.some(tag => activityTags.includes(tag));
        if (!hasMatchingTag) return;
      }

      activities.push({
        id: doc.id,
        title: activity.title,
        description: activity.description,
        location: activity.location,
        startDate: activity.startDate,
        endDate: activity.endDate,
        tags: activity.tags,
        language: activity.language,
        type: activity.type,
        organizer: activity.organizer,
        maxParticipants: activity.maxParticipants,
        currentParticipants: activity.currentParticipants || 0,
        imageUrl: activity.imageUrl || "",
      });
    });

    res.json({ activities });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/activities/:id
 * Retourne les détails d'une activité spécifique
 */
exports.getActivityById = async (req, res) => {
  try {
    const doc = await db.collection("activities").doc(req.params.id).get();

    if (!doc.exists) {
      return res.status(404).json({ message: "Activity not found" });
    }

    const activity = doc.data();

    res.json({
      id: doc.id,
      title: activity.title,
      description: activity.description,
      location: activity.location,
      startDate: activity.startDate,
      endDate: activity.endDate,
      tags: activity.tags,
      language: activity.language,
      type: activity.type,
      organizer: activity.organizer,
      maxParticipants: activity.maxParticipants,
      currentParticipants: activity.currentParticipants || 0,
      imageUrl: activity.imageUrl || "",
      requirements: activity.requirements || [],
      contactInfo: activity.contactInfo || {},
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * POST /api/activities/:id/join
 * Permet à un utilisateur de participer à une activité
 */
exports.joinActivity = async (req, res) => {
  try {
    const activityDoc = await db.collection("activities").doc(req.params.id).get();

    if (!activityDoc.exists) {
      return res.status(404).json({ message: "Activity not found" });
    }

    const activity = activityDoc.data();
    const userId = req.user.id;

    // Vérifier si l'utilisateur n'est pas déjà inscrit
    if (activity.participants && activity.participants.includes(userId)) {
      return res.status(400).json({ message: "Already registered for this activity" });
    }

    // Vérifier la capacité maximale
    const currentCount = activity.currentParticipants || 0;
    if (activity.maxParticipants && currentCount >= activity.maxParticipants) {
      return res.status(400).json({ message: "Activity is full" });
    }

    // Ajouter le participant
    await db.collection("activities").doc(req.params.id).update({
      participants: [...(activity.participants || []), userId],
      currentParticipants: currentCount + 1,
    });

    res.json({ message: "Successfully joined the activity" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * POST /api/activities/:id/leave
 * Permet à un utilisateur de quitter une activité
 */
exports.leaveActivity = async (req, res) => {
  try {
    const activityDoc = await db.collection("activities").doc(req.params.id).get();

    if (!activityDoc.exists) {
      return res.status(404).json({ message: "Activity not found" });
    }

    const activity = activityDoc.data();
    const userId = req.user.id;

    // Vérifier si l'utilisateur est bien inscrit
    if (!activity.participants || !activity.participants.includes(userId)) {
      return res.status(400).json({ message: "Not registered for this activity" });
    }

    // Retirer le participant
    const updatedParticipants = activity.participants.filter(id => id !== userId);
    await db.collection("activities").doc(req.params.id).update({
      participants: updatedParticipants,
      currentParticipants: Math.max(0, (activity.currentParticipants || 0) - 1),
    });

    res.json({ message: "Successfully left the activity" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
