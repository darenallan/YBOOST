const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Translate } = require("@google-cloud/translate").v2;
const aiSecurity = require("../services/security/aiSecurity");

// Initialisation Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
const translate = new Translate({ key: process.env.GOOGLE_TRANSLATE_API_KEY });

// Système prompt de l'assistant étudiant
const SYSTEM_PROMPT = `Tu es un assistant bienveillant et expert dédié à aider les étudiants internationaux à s'intégrer dans leur nouveau pays.

Tu peux les aider avec :
- Les démarches administratives (visa, titre de séjour, inscription universitaire)
- La vie pratique (logement, transport, banque, santé)
- Les ressources universitaires (bibliothèques, associations, bourses)
- L'intégration sociale (rencontrer des gens, activités culturelles)
- Les questions de langue et de culture

Réponds de manière claire, chaleureuse et pratique. Si tu ne connais pas une information spécifique à une ville ou institution, indique-le honnêtement et oriente l'étudiant vers les bons interlocuteurs.`;

/**
 * POST /api/ai/chat
 * Envoie un message à l'assistant IA et retourne sa réponse.
 * Body : { message: string, history: [{role, content}] }
 *
 * Le frontend envoie l'historique de la conversation pour maintenir le contexte.
 */
exports.chat = async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ message: "Message is required" });
    }

    // Sécuriser le message avec le service de sécurité IA
    const securityCheck = aiSecurity(message);
    if (!securityCheck.valid) {
      return res.status(400).json({ message: securityCheck.error });
    }

    // Construire le prompt complet avec le contexte
    const fullPrompt = `${SYSTEM_PROMPT}\n\nConversation précédente:\n${history.slice(-5).map(h => `${h.role}: ${h.content}`).join('\n')}\n\nUtilisateur: ${securityCheck.message}`;

    // Appel à Gemini AI
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const reply = response.text();

    res.json({
      reply,
      usage: {
        promptTokens: response.usageMetadata?.promptTokenCount || 0,
        completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: response.usageMetadata?.totalTokenCount || 0
      }
    });
  } catch (error) {
    console.error("Gemini AI error:", error);
    res.status(500).json({ message: "AI service unavailable", error: error.message });
  }
};

/**
 * POST /api/ai/translate
 * Traduit un texte vers une langue cible.
 * Body : { text: string, targetLanguage: string, sourceLanguage?: string }
 * targetLanguage : code ISO 639-1 (ex: "fr", "en", "es", "ar")
 */
exports.translateText = async (req, res) => {
  try {
    const { text, targetLanguage, sourceLanguage } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Text is required" });
    }

    if (!targetLanguage) {
      return res.status(400).json({ message: "targetLanguage is required" });
    }

    const options = { to: targetLanguage };
    if (sourceLanguage) {
      options.from = sourceLanguage;
    }

    const [translation, metadata] = await translate.translate(text.trim(), options);

    res.json({
      original: text.trim(),
      translated: translation,
      sourceLanguage: metadata.data?.translations?.[0]?.detectedSourceLanguage || sourceLanguage || "auto",
      targetLanguage,
    });
  } catch (error) {
    console.error("Translate error:", error);
    res.status(500).json({ message: "Translation service unavailable", error: error.message });
  }
};

/**
 * POST /api/ai/detect-language
 * Détecte automatiquement la langue d'un texte.
 * Body : { text: string }
 */
exports.detectLanguage = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Text is required" });
    }

    const [detections] = await translate.detect(text.trim());
    const detection = Array.isArray(detections) ? detections[0] : detections;

    res.json({
      language: detection.language,
      confidence: detection.confidence,
    });
  } catch (error) {
    console.error("Detect language error:", error);
    res.status(500).json({ message: "Detection service unavailable", error: error.message });
  }
};
