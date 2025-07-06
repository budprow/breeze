const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const {GoogleGenerativeAI} = require("@google/generative-ai");

// --- INITIALIZATION ---
admin.initializeApp();
const firestore = admin.firestore();
const app = express();

// --- MIDDLEWARE ---
// This will handle all CORS requests for all routes in the app
app.use(cors({origin: true}));
app.use(express.json());

// --- GEMINI AI SETUP ---
const geminiApiKey = functions.config().gemini ? functions.config().gemini.api_key : "";
if (!geminiApiKey) {
  console.warn("Gemini API key not found. /generate-quiz will fail.");
}
const genAI = new GoogleGenerativeAI(geminiApiKey);
const model = genAI.getGenerativeModel({model: "gemini-1.5-flash"});


// --- HELPER FUNCTIONS ---
const parseJsonFromAiResponse = (rawText) => {
  const match = rawText.match(/```json\n([\s\S]*?)\n```/);
  if (!match || !match[1]) return null;
  try {
    return JSON.parse(match[1]);
  } catch (error) {
    return null;
  }
};

const verifyFirebaseToken = async (req, res, next) => {
  const idToken = req.headers.authorization?.split("Bearer ")[1];
  if (!idToken) {
    return res.status(401).send("Unauthorized");
  }
  try {
    req.user = await admin.auth().verifyIdToken(idToken);
    next();
  } catch (error) {
    res.status(403).send("Could not verify token");
  }
};

// --- API ROUTES ---

app.post("/generate-quiz", async (req, res) => {
  const {text, refinementText} = req.body;
  if (!text) return res.status(400).send("No text provided.");

  const prompt = `
      Based on the following text, generate a multiple-choice quiz with 5 to 8 questions.
      Each question must have exactly 4 answer options, with only one being correct.
      ${refinementText ? `Follow these specific instructions: "${refinementText}".` : ""}
      Format the output as a single JSON object inside a \`\`\`json code block.
      The JSON object should have a single key "questions", which is an array.
      Each object in the "questions" array should have:
      - a "question" key with the question text (string).
      - an "options" key with an array of 4 answer strings.
      - a "correctAnswer" key with the string of the correct answer, which must exactly match one of the strings in the "options" array.
      Here is the text to analyze:
      ---
      ${text}
      ---
    `;
  try {
    const result = await model.generateContent(prompt);
    const quizData = parseJsonFromAiResponse(result.response.text());
    if (!quizData) return res.status(500).send("Failed to parse AI response.");
    res.status(200).json(quizData);
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    res.status(500).send("Error generating quiz.");
  }
});

app.post("/create-invite", verifyFirebaseToken, async (req, res) => {
  const {restaurantId} = req.body;
  const managerId = req.user.uid;
  try {
    const inviteRef = await firestore.collection("restaurants").doc(restaurantId).collection("invites").add({
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      used: false,
      createdBy: managerId,
    });
    res.status(201).json({inviteCode: inviteRef.id});
  } catch (error) {
    res.status(500).send("Server error creating invite.");
  }
});

app.post("/validate-invite", async (req, res) => {
  const {inviteCode} = req.body;
  if (!inviteCode) return res.status(400).json({error: "Invite code missing."});
  try {
    const restaurants = await firestore.collection("restaurants").get();
    for (const restaurant of restaurants.docs) {
      const docRef = firestore.collection("restaurants").doc(restaurant.id).collection("invites").doc(inviteCode);
      const doc = await docRef.get();
      if (doc.exists) {
        if (doc.data().used) return res.status(400).json({error: "Invite already used."});
        return res.status(200).json({restaurantId: restaurant.id});
      }
    }
    return res.status(404).json({error: "Invite code not found."});
  } catch (error) {
    res.status(500).json({error: "Server error validating invite."});
  }
});

app.post("/mark-invite-used", async (req, res) => {
  const {inviteCode} = req.body;
  if (!inviteCode) return res.status(400).send("Invite code is missing.");
  try {
    const restaurants = await firestore.collection("restaurants").get();
    for (const restaurant of restaurants.docs) {
      const docRef = firestore.collection("restaurants").doc(restaurant.id).collection("invites").doc(inviteCode);
      const doc = await docRef.get();
      if (doc.exists) {
        await docRef.update({used: true});
        return res.status(200).send("Invite marked as used.");
      }
    }
    res.status(200).send("Invite not found, but operation is successful.");
  } catch (error) {
    res.status(500).send("Server error marking invite as used.");
  }
});

// --- EXPORT THE EXPRESS APP AS A SINGLE CLOUD FUNCTION ---
exports.api = functions.https.onRequest(app);
