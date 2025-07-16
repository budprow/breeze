const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const {GoogleGenerativeAI} = require("@google/generative-ai");
const {onRequest} = require("firebase-functions/v2/https");
const {FieldValue} = require("firebase-admin/firestore");
const quizGenerator = require("./services/quizGenerator");

// --- INITIALIZATION ---
admin.initializeApp();
const app = express();

// --- MIDDLEWARE ---
app.use(cors({origin: true}));
app.use(express.json());

// --- GEMINI AI SETUP ---
const {GEMINI_API_KEY} = process.env;
let genAI;
if (GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
} else {
  console.warn("GEMINI_API_KEY not found.");
}

// --- HELPER FUNCTIONS ---
const verifyFirebaseToken = async (req, res, next) => {
  const idToken = req.headers.authorization?.split("Bearer ")[1];
  if (!idToken) return res.status(401).send("Unauthorized");
  try {
    req.user = await admin.auth().verifyIdToken(idToken);
    next();
  } catch (error) {
    res.status(403).send("Could not verify token");
  }
};

// --- API ROUTES ---

app.post("/generate-quiz", verifyFirebaseToken, async (req, res) => {
  if (!genAI) return res.status(500).send("Server not configured.");
  try {
    const {text, refinementText} = req.body;
    if (!text) return res.status(400).send("No text provided.");

    const quizData = await quizGenerator.generateMultipleChoice(genAI, text, refinementText);

    const db = admin.firestore();
    const quizRef = await db.collection("quizzes").add({
      ...quizData,
      ownerId: req.user.uid,
      createdAt: FieldValue.serverTimestamp(),
    });

    res.status(200).json({questions: quizData.questions, quizId: quizRef.id});
  } catch (error) {
    res.status(500).send("Error generating quiz.");
  }
});

// --- NEW ENDPOINT TO CREATE A QUIZ-SPECIFIC INVITE ---
app.post("/create-quiz-invite", verifyFirebaseToken, async (req, res) => {
  const db = admin.firestore();
  const {quizId} = req.body;
  const inviterId = req.user.uid;

  if (!quizId) {
    return res.status(400).send("Quiz ID is required.");
  }

  try {
    const inviteRef = await db.collection("quizInvites").add({
      quizId: quizId,
      inviterId: inviterId,
      createdAt: FieldValue.serverTimestamp(),
    });
    res.status(201).json({inviteId: inviteRef.id});
  } catch (error) {
    console.error("Error creating quiz invite:", error);
    res.status(500).send("Server error creating quiz invite.");
  }
});

// --- CLOUD FUNCTION EXPORT ---
exports.api = onRequest({secrets: ["GEMINI_API_KEY"]}, app);
