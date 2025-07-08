const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const functions = require("firebase-functions"); // <-- This is the new line that fixes the error
const {GoogleGenerativeAI} = require("@google/generative-ai");
// Import the v2 functions we need
const {onRequest} = require("firebase-functions/v2/https");
const {onCall} = require("firebase-functions/v2/https");

// --- INITIALIZATION ---
admin.initializeApp();
const firestore = admin.firestore();
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


// --- HELPER FUNCTIONS ---
const parseJsonFromAiResponse = (rawText) => {
  const match = rawText.match(/```json\n([\s\S]*?)\n```/);
  if (!match || !match[1]) {
    console.error("Could not find a JSON code block in the AI response.");
    return null;
  }
  try {
    return JSON.parse(match[1]);
  } catch (error) {
    console.error("Failed to parse JSON from the AI response:", error);
    return null;
  }
};

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

app.post("/generate-quiz", async (req, res) => {
  if (!genAI) {
    return res.status(500).send("Server is not configured with a Gemini API key.");
  }
  const model = genAI.getGenerativeModel({model: "gemini-1.5-flash"});
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
  if (!restaurantId) {
    return res.status(400).send("Restaurant ID is required.");
  }
  try {
    const inviteRef = await firestore.collection("restaurants").doc(restaurantId).collection("invites").add({
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      used: false,
      createdBy: managerId,
    });
    res.status(201).json({inviteCode: inviteRef.id});
  } catch (error) {
    console.error("Error creating invite:", error);
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
    console.error("Error validating invite:", error);
    res.status(500).json({error: "Server error validating invite."});
  }
});

app.post("/mark-invite-used", async (req, res) => {
  const {inviteCode} = req.body;
  if (!inviteCode) return res.status(400).send("Invite code is missing.");
  try {
    const restaurants = await firestore.collection("restaurants").get();
    let foundAndUpdated = false;
    for (const restaurant of restaurants.docs) {
      const docRef = firestore.collection("restaurants").doc(restaurant.id).collection("invites").doc(inviteCode);
      const doc = await docRef.get();
      if (doc.exists) {
        await docRef.update({used: true});
        foundAndUpdated = true;
        break;
      }
    }
    if (foundAndUpdated) {
      return res.status(200).send("Invite marked as used.");
    } else {
      return res.status(404).send("Invite not found.");
    }
  } catch (error) {
    console.error("Error marking invite as used:", error);
    res.status(500).send("Server error marking invite as used.");
  }
});


// --- CLOUD FUNCTION EXPORTS ---

// This is your existing API function
exports.api = onRequest({secrets: ["GEMINI_API_KEY"]}, app);


// --- THIS IS THE NEW FUNCTION TO ADD ---
// This function allows you to set a custom role on a user.
exports.setManagerRole = onCall(async (request) => {
  // In a real app, you would add security here to ensure only an admin can call this.
  try {
    const uid = request.data.uid;
    if (!uid) {
      throw new Error("The function must be called with a \"uid\" argument.");
    }
    // This sets the custom claim { role: 'manager' } on the user account
    await admin.auth().setCustomUserClaims(uid, {role: "manager"});
    return {message: `Success! User ${uid} has now been made a manager.`};
  } catch (error) {
    console.error("Error setting custom claim:", error);
    // Throw an error so the client knows something went wrong.
    throw new functions.https.HttpsError("internal", "Unable to set custom role.");
  }
});
