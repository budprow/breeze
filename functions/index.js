const functions = require("firebase-functions");
const admin = require("firebase-admin");
const {GoogleGenerativeAI} = require("@google/generative-ai");
const cors = require("cors")({origin: true});

// --- INITIALIZATION ---
admin.initializeApp();
const firestore = admin.firestore();

// Safely initialize the Gemini client from secure config
const geminiApiKey = functions.config().gemini ? functions.config().gemini.api_key : "";
if (!geminiApiKey) {
  console.warn("Gemini API key not found in function config. /generateQuiz will fail.");
}
const genAI = new GoogleGenerativeAI(geminiApiKey);
const model = genAI.getGenerativeModel({model: "gemini-1.5-flash"});


// --- HELPER FUNCTIONS ---

const getAuthenticatedUser = async (req) => {
  if (!req.headers.authorization || !req.headers.authorization.startsWith("Bearer ")) {
    console.error("No authorization header or Bearer scheme found.");
    return null;
  }
  const idToken = req.headers.authorization.split("Bearer ")[1];
  try {
    return await admin.auth().verifyIdToken(idToken);
  } catch (error) {
    console.error("Error verifying auth token:", error);
    return null;
  }
};

const parseJsonFromAiResponse = (rawText) => {
  const match = rawText.match(/```json\n([\s\S]*?)\n```/);
  if (!match || !match[1]) {
    console.error("No valid JSON block found in the AI response.");
    return null;
  }
  try {
    return JSON.parse(match[1]);
  } catch (error) {
    console.error("Failed to parse JSON from AI response:", error);
    return null;
  }
};


// --- INDIVIDUAL, EXPORTED CLOUD FUNCTIONS ---

exports.generateQuiz = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }
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
      const quizData = parseJsonFromAiResponse(result.response.text());
      if (!quizData) {
        return res.status(500).send("Failed to generate a valid quiz from the AI response.");
      }
      res.status(200).json(quizData);
    } catch (error) {
      console.error("Error calling Gemini API:", error);
      res.status(500).send("An error occurred while generating the quiz.");
    }
  });
});

exports.createInvite = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(403).send("Unauthorized");
    }

    const {restaurantId} = req.body;
    try {
      const inviteRef = await firestore.collection("restaurants").doc(restaurantId).collection("invites").add({
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        used: false,
        createdBy: user.uid,
      });
      res.status(201).json({inviteCode: inviteRef.id});
    } catch (error) {
      console.error("Error creating invite:", error);
      res.status(500).send("Server error while creating invite.");
    }
  });
});

exports.validateInvite = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }
    const {inviteCode} = req.body;
    if (!inviteCode) {
      return res.status(400).json({error: "Invite code is missing."});
    }
    try {
      const restaurantsSnapshot = await firestore.collection("restaurants").get();
      let inviteDoc = null;
      let restaurantId = null;

      for (const restaurant of restaurantsSnapshot.docs) {
        const docRef = firestore.collection("restaurants").doc(restaurant.id).collection("invites").doc(inviteCode);
        const doc = await docRef.get();
        if (doc.exists) {
          inviteDoc = doc;
          restaurantId = restaurant.id;
          break;
        }
      }

      if (!inviteDoc) {
        return res.status(404).json({error: "Invite code not found."});
      }

      if (inviteDoc.data().used) {
        return res.status(400).json({error: "This invite has already been used."});
      }

      res.status(200).json({restaurantId});
    } catch (error) {
      console.error("Error in /validate-invite:", error);
      res.status(500).json({error: "Server error validating invite."});
    }
  });
});

exports.markInviteUsed = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }
    const {inviteCode} = req.body;
    if (!inviteCode) {
      return res.status(400).send("Invite code is missing.");
    }
    try {
      const restaurantsSnapshot = await firestore.collection("restaurants").get();
      let inviteRef = null;

      for (const restaurant of restaurantsSnapshot.docs) {
        const docRef = firestore.collection("restaurants").doc(restaurant.id).collection("invites").doc(inviteCode);
        const doc = await docRef.get();
        if (doc.exists) {
          inviteRef = docRef;
          break;
        }
      }

      if (inviteRef) {
        await inviteRef.update({used: true});
      }
      res.status(200).send("Invite marked as used.");
    } catch (error) {
      console.error("Error marking invite used:", error);
      res.status(500).send("Server error marking invite as used.");
    }
  });
});
