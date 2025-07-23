const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const functions = require("firebase-functions");
const {GoogleGenerativeAI} = require("@google/generative-ai");
const {onRequest} = require("firebase-functions/v2/http");
const {FieldValue} = require("firebase-admin/firestore");
const quizGenerator = require("./services/quizGenerator");

// This line allows us to use a .env file for local development
require("dotenv").config();

// --- INITIALIZATION ---
admin.initializeApp();
const app = express();

// --- MIDDLEWARE ---
// This is the fix: It explicitly handles the preflight `OPTIONS` requests
// that browsers send to check CORS permissions, allowing them to pass through
// before the token verification middleware is run.
app.use(cors({origin: true}));

app.use(express.json());


// --- GEMINI AI SETUP ---
const geminiApiKey = process.env.GEMINI_API_KEY || (functions.config().gemini && functions.config().gemini.key);
let genAI;
if (geminiApiKey) {
  genAI = new GoogleGenerativeAI(geminiApiKey);
} else {
  console.warn("GEMINI_API_KEY not found. The /generate-quiz endpoint will not work.");
}

// --- HELPER FUNCTIONS ---
const verifyFirebaseToken = async (req, res, next) => {
  const idToken = req.headers.authorization?.split("Bearer ")[1];
  if (!idToken) {
    return res.status(401).send("Unauthorized: No token provided.");
  }
  try {
    req.user = await admin.auth().verifyIdToken(idToken);
    next();
  } catch (error) {
    console.error("Error verifying Firebase token:", error);
    res.status(403).send("Could not verify token");
  }
};

// --- API ROUTES ---

app.post("/generate-quiz", verifyFirebaseToken, async (req, res) => {
  if (!genAI) {
    return res.status(500).send("Server is not configured with a Gemini API key.");
  }
  try {
    const {text, refinementText} = req.body;
    if (!text) return res.status(400).send("No text provided.");
    const quizData = await quizGenerator.generateMultipleChoice(genAI, text, refinementText);
    if (!quizData) {
      return res.status(500).send("Failed to parse AI response.");
    }
    res.status(200).json(quizData);
  } catch (error) {
    console.error("Error in /generate-quiz route:", error);
    res.status(500).send("Error generating quiz.");
  }
});

app.post("/save-quiz", verifyFirebaseToken, async (req, res) => {
  const db = admin.firestore();
  const {quizData, score, documentName, documentId} = req.body;
  const userId = req.user.uid;

  if (!quizData || score === undefined || !documentName || !documentId) {
    return res.status(400).send("Missing required quiz data for saving.");
  }

  try {
    await db.collection("quizzes").add({
      ownerId: userId,
      documentId: documentId,
      documentName: documentName,
      score: score,
      totalQuestions: quizData.length,
      quizData: quizData,
      completedAt: FieldValue.serverTimestamp(),
    });
    res.status(201).send("Quiz saved successfully.");
  } catch (error) {
    console.error("Error saving quiz:", error);
    res.status(500).send("Server error while saving quiz.");
  }
});


// --- CLOUD FUNCTION EXPORTS ---
exports.api = onRequest({secrets: ["GEMINI_API_KEY"]}, app);
