const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const functions = require("firebase-functions");
const {GoogleGenerativeAI} = require("@google/generative-ai");
const {onRequest} = require("firebase-functions/v2/https");
const {onCall} = require("firebase-functions/v2/https");
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

// ... (generate-quiz and save-quiz remain the same)
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


app.post("/create-invite", verifyFirebaseToken, async (req, res) => {
  const db = admin.firestore();
  const {restaurantId} = req.body;
  const managerId = req.user.uid;
  if (!restaurantId) {
    return res.status(400).send("Restaurant ID is required.");
  }
  try {
    const inviteRef = await db.collection("invites").add({ // <-- Using top-level 'invites' collection
      restaurantId: restaurantId,
      createdAt: FieldValue.serverTimestamp(),
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
  const db = admin.firestore();
  const {inviteCode} = req.body;
  if (!inviteCode) {
    return res.status(400).json({error: "Invite code is missing."});
  }
  try {
    const docRef = db.collection("invites").doc(inviteCode);
    const doc = await docRef.get();

    if (doc.exists) {
      if (doc.data().used) return res.status(400).json({error: "Invite already used."});
      return res.status(200).json({restaurantId: doc.data().restaurantId});
    } else {
      return res.status(404).json({error: "Invite code not found."});
    }
  } catch (error) {
    console.error("Error validating invite:", error);
    res.status(500).json({error: "Server error validating invite."});
  }
});

app.post("/mark-invite-used", async (req, res) => {
  const db = admin.firestore();
  const {inviteCode} = req.body;
  if (!inviteCode) {
    return res.status(400).send("Invite code is missing.");
  }
  try {
    const docRef = db.collection("invites").doc(inviteCode);
    const doc = await docRef.get();

    if (doc.exists) {
      await docRef.update({used: true});
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
exports.api = onRequest({secrets: ["GEMINI_API_KEY"]}, app);

exports.setManagerRole = onCall(async (request) => {
  try {
    const {uid, restaurantId} = request.data; // Get both uid and restaurantId
    if (!uid || !restaurantId) {
      throw new Error("The function must be called with \"uid\" and \"restaurantId\" arguments.");
    }

    // Set both the role and restaurantId as custom claims on the user's token
    await admin.auth().setCustomUserClaims(uid, {
      role: "administrator",
      restaurantId: restaurantId,
    });

    return {message: `Success! User ${uid} has now been made an administrator for restaurant ${restaurantId}.`};
  } catch (error) {
    console.error("Error setting custom claim:", error);
    throw new functions.https.HttpsError("internal", "Unable to set custom role.");
  }
});
