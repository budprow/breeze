const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const {onRequest} = require("firebase-functions/v2/https");
const {GoogleGenerativeAI} = require("@google/generative-ai");
const quizGenerator = require("./services/quizGenerator.cjs");
require("dotenv").config();

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
  console.warn("GEMINI_API_KEY not found. The /generate-quiz endpoint will not work.");
}

// --- API ROUTES ---

app.post("/generate-quiz", async (req, res) => {
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

// --- CLOUD FUNCTION EXPORTS ---
exports.api = onRequest({secrets: ["GEMINI_API_KEY"]}, app);
