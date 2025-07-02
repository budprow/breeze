const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const {GoogleGenerativeAI} = require("@google/generative-ai");


// Initialize Firebase Admin SDK automatically. No service key is needed.
admin.initializeApp();


const app = express();


// Automatically allow cross-origin requests from any domain.
app.use(cors({origin: true}));
app.use(express.json());


// Initialize Gemini using the secure config we set up.
// Safely access the Gemini API key from the environment configuration
const geminiApiKey = functions.config().gemini ? functions.config().gemini.api_key : "";
if (!geminiApiKey) {
  console.warn(
      "Gemini API key not found in function configuration. " +
     "The /generate-quiz endpoint will fail until the key is set.",
  );
}
const genAI = new GoogleGenerativeAI(geminiApiKey);
const model = genAI.getGenerativeModel({model: "gemini-1.5-flash"});
const firestore = admin.firestore();


/**
* Helper function to find and parse a JSON object from the AI's raw text response.
* @param {string} rawText The raw text response from the generative AI model.
* @return {object|null} The parsed JSON object or null if not found.
*/
const parseJsonFromAiResponse = (rawText) => {
  const match = rawText.match(/```json\n([\s\S]*?)\n```/);
  if (!match || !match[1]) {
    console.error("No valid JSON block found in the AI response.");
    return null;
  }
  try {
    return JSON.parse(match[1]);
  } catch (error) {
    console.error("Failed to parse JSON from the AI response:", error);
    return null;
  }
};


// --- API ROUTES ---


// Middleware to verify Firebase token for protected routes
const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const idToken = authHeader ? authHeader.split("Bearer ")[1] : undefined;
  if (!idToken) {
    return res.status(401).send("Unauthorized: No token provided.");
  }
  try {
    req.user = await admin.auth().verifyIdToken(idToken);
    next();
  } catch (error) {
    res.status(403).send("Could not verify token.");
  }
};


// Route to generate a quiz using Gemini
app.post("/generate-quiz", async (req, res) => {
  const {text, refinementText} = req.body;
  if (!text) {
    return res.status(400).send("No text provided for quiz generation.");
  }


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
    const response = await result.response;
    const rawText = response.text();
    const quizData = parseJsonFromAiResponse(rawText);


    if (!quizData) {
      return res.status(500).send("Failed to generate a valid quiz from the AI response.");
    }
    res.status(200).json(quizData);
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    res.status(500).send("An error occurred while generating the quiz.");
  }
});


// Endpoint for a manager to create an invite code
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
    console.error("Error creating invite:", error);
    res.status(500).send("Server error while creating invite.");
  }
});


// Endpoint for the frontend to validate an invite code before creating a user
app.post("/validate-invite", async (req, res) => {
  const {inviteCode} = req.body;
  try {
    const invitesQuery = await firestore.collectionGroup("invites").where(admin.firestore.FieldPath.documentId(), "==", inviteCode).get();
    if (invitesQuery.empty) {
      return res.status(404).json({error: "Invite code not found."});
    }
    const inviteDoc = invitesQuery.docs[0];
    if (inviteDoc.data().used) {
      return res.status(400).json({error: "This invite has already been used."});
    }
    const restaurantId = inviteDoc.ref.parent.parent.id;
    res.status(200).json({restaurantId});
  } catch (error) {
    console.error("Error validating invite:", error);
    res.status(500).json({error: "Server error validating invite."});
  }
});


// Endpoint to mark an invite as used after successful employee creation
app.post("/mark-invite-used", async (req, res) => {
  const {inviteCode} = req.body;
  try {
    const invitesQuery = await firestore.collectionGroup("invites").where(admin.firestore.FieldPath.documentId(), "==", inviteCode).get();
    if (!invitesQuery.empty) {
      const inviteDoc = invitesQuery.docs[0];
      await inviteDoc.ref.update({used: true});
    }
    res.status(200).send("Invite marked as used.");
  } catch (error) {
    console.error("Error marking invite used:", error);
    res.status(500).send("Server error marking invite as used.");
  }
});


// Expose the entire Express app as a single Cloud Function named "api".
// Your new backend URL will be https://<your-region>-<your-project-id>.cloudfunctions.net/api
exports.api = functions.https.onRequest(app);
