const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const functions = require("firebase-functions");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { onRequest } = require("firebase-functions/v2/https");
const { FieldValue } = require("firebase-admin/firestore");
const quizGenerator = require("./services/quizGenerator.cjs");
require("dotenv").config();

// --- INITIALIZATION ---
admin.initializeApp();
const app = express();

// --- MIDDLEWARE ---
const corsOptions = {
  origin: ["http://localhost:5173", "https://breeze-omega.vercel.app"],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json());


// --- GEMINI AI SETUP ---
const geminiApiKey = process.env.GEMINI_API_KEY || (functions.config().gemini && functions.config().gemini.key);
let genAI;
if (geminiApiKey) {
  genAI = new GoogleGenerativeAI(geminiApiKey);
} else {
  console.warn("GEMINI_API_KEY not found. The /generate-quiz endpoint will not work.");
}

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
    const { text, refinementText } = req.body;
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
    const { quizData, score, documentName, documentId } = req.body;
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

app.post("/save-shared-quiz-result", verifyFirebaseToken, async (req, res) => {
  const db = admin.firestore();
  const { quizId, score, quizData } = req.body;
  const { uid, email } = req.user;

  if (!quizId || score === undefined || !quizData) {
    return res.status(400).send("Missing required data to save quiz result.");
  }

  try {
    // ** THE FIX: Using the correct Admin SDK syntax to get the document **
    const originalQuizRef = db.collection('quizzes').doc(quizId);
    const originalQuizSnap = await originalQuizRef.get();

    if (!originalQuizSnap.exists) {
      return res.status(404).send("Original quiz not found.");
    }

    const documentName = originalQuizSnap.data().documentName;

    // Save result to the original quiz's sub-collection
    await db.collection('quizzes').doc(quizId).collection('results').add({
      takerId: uid,
      takerEmail: email,
      score: score,
      completedAt: FieldValue.serverTimestamp()
    });

    // Save a copy to the quiz taker's own collection
    await db.collection('quizzes').add({
      ownerId: uid,
      documentId: originalQuizSnap.data().documentId,
      documentName: documentName,
      score: score,
      totalQuestions: quizData.length,
      quizData: quizData,
      completedAt: FieldValue.serverTimestamp(),
      originalQuizId: quizId // Link back to the original
    });

    res.status(201).send("Quiz result saved successfully.");
  } catch (error) {
    console.error("Error saving shared quiz result:", error);
    res.status(500).send("Server error while saving quiz result.");
  }
});


// --- CLOUD FUNCTION EXPORTS ---
exports.api = onRequest({ secrets: ["GEMINI_API_KEY"] }, app);