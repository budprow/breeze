const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const functions = require("firebase-functions");
const {GoogleGenerativeAI} = require("@google/generative-ai");
const {onRequest} = require("firebase-functions/v2/https");
const {onCall} = require("firebase-functions/v2/https");
const quizGenerator = require("./services/quizGenerator");

// --- INITIALIZATION ---
admin.initializeApp();
const firestore = admin.firestore(); // We will use this 'firestore' variable
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

app.post("/generate-quiz", async (req, res) => {
  if (!genAI) {
    return res.status(500).send("Server is not configured with a Gemini API key.");
  }
  try {
    const {text, refinementText} = req.body;
    if (!text) return res.status(400).send("No text provided.");

    const quizData = await quizGenerator.generateMultipleChoice(genAI, text, refinementText);

    if (!quizData) {
      return res.status(500).send("Failed to parse AI response from the generator service.");
    }
    res.status(200).json(quizData);
  } catch (error) {
    console.error("Error in /generate-quiz route:", error);
    res.status(500).send("Error generating quiz.");
  }
});

app.post("/save-quiz", verifyFirebaseToken, async (req, res) => {
  try {
    const {restaurantId, documentId, quizData, groupName} = req.body;
    const {uid} = req.user;

    if (!restaurantId || !documentId || !quizData) {
      return res.status(400).send("Missing required data to save quiz.");
    }

    const quizRef = await firestore
        .collection("restaurants")
        .doc(restaurantId)
        .collection("documents")
        .doc(documentId)
        .collection("quizzes")
        .add({
          ...quizData,
          name: groupName || "Untitled Quiz",
          createdAt: admin.firestore.FieldValue.serverTimestamp(), // This one is also correct as it's a different context
          createdBy: uid,
          assignedTo: [],
        });

    res.status(201).send({message: "Quiz saved successfully", quizId: quizRef.id});
  } catch (error) {
    console.error("Error saving quiz:", error);
    res.status(500).send("Server error while saving quiz.");
  }
});

app.post("/assign-quiz", verifyFirebaseToken, async (req, res) => {
  try {
    const {restaurantId, documentId, quizId, userIds} = req.body;
    if (!restaurantId || !documentId || !quizId || !userIds) {
      return res.status(400).send("Missing required data to assign quiz.");
    }
    const quizRef = firestore.collection("restaurants").doc(restaurantId).collection("documents").doc(documentId).collection("quizzes").doc(quizId);
    await quizRef.update({assignedTo: userIds});
    res.status(200).send({message: "Quiz assigned successfully."});
  } catch (error) {
    console.error("Error assigning quiz:", error);
    res.status(500).send("Server error while assigning quiz.");
  }
});

app.get("/view-scores/:restaurantId/:documentId", verifyFirebaseToken, async (req, res) => {
  try {
    const {restaurantId, documentId} = req.params;
    const scoresSnapshot = await firestore.collection("restaurants").doc(restaurantId).collection("documents").doc(documentId).collection("scores").get();
    const scores = scoresSnapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
    res.status(200).json(scores);
  } catch (error) {
    console.error("Error fetching scores:", error);
    res.status(500).send("Server error while fetching scores.");
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
      // --- THIS IS THE FIX ---
      createdAt: firestore.FieldValue.serverTimestamp(), // Use the firestore instance
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
exports.api = onRequest({secrets: ["GEMINI_API_KEY"]}, app);

exports.setManagerRole = onCall(async (request) => {
  try {
    const uid = request.data.uid;
    if (!uid) {
      throw new Error("The function must be called with a \"uid\" argument.");
    }
    await admin.auth().setCustomUserClaims(uid, {role: "administrator"});
    return {message: `Success! User ${uid} has now been made an administrator.`};
  } catch (error) {
    console.error("Error setting custom claim:", error);
    throw new functions.https.HttpsError("internal", "Unable to set custom role.");
  }
});
