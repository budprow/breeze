const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const admin = require('firebase-admin');

const app = express();
const port = 3001;

// --- MIDDLEWARE CONFIGURATION ---
app.use(cors({ origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Firebase Admin Initialization ---
try {
  const serviceAccount = require('./serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log("Firebase Admin SDK initialized successfully.");
} catch (e) {
  console.error("FIREBASE ADMIN SDK INITIALIZATION ERROR:", e);
}
const firestore = admin.firestore();

// --- Gemini AI Initialization ---
const geminiApiKey = process.env.GEMINI_API_KEY;
if (!geminiApiKey) {
  console.warn("Gemini API key not found in .env file. /generate-quiz will fail.");
}
const genAI = new GoogleGenerativeAI(geminiApiKey);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// --- HELPER/MIDDLEWARE FUNCTIONS ---

const verifyFirebaseToken = async (req, res, next) => {
  const idToken = req.headers.authorization?.split('Bearer ')[1];
  if (!idToken) {
    return res.status(401).send('Unauthorized');
  }
  try {
    req.user = await admin.auth().verifyIdToken(idToken);
    next();
  } catch (error) {
    console.error("Error verifying auth token:", error);
    res.status(403).send('Could not verify token');
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

// --- ROUTES ---

app.post('/generate-quiz', async (req, res) => {
    const { text, refinementText } = req.body;
    if (!text) {
        return res.status(400).send("No text provided for quiz generation.");
    }
    if (!geminiApiKey) {
        return res.status(500).send("Backend is not configured with a Gemini API key.");
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


app.post('/create-invite', verifyFirebaseToken, async (req, res) => {
  const { restaurantId } = req.body;
  const managerId = req.user.uid;
  if (!restaurantId || !managerId) {
      return res.status(400).send('Missing restaurantId or managerId.');
  }
  try {
    const inviteRef = await firestore.collection('restaurants').doc(restaurantId).collection('invites').add({
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      used: false,
      createdBy: managerId,
    });
    res.status(201).json({ inviteCode: inviteRef.id });
  } catch (error) {
    console.error("Error creating invite:", error);
    res.status(500).send('Server error while creating invite.');
  }
});

app.post('/validate-invite', async (req, res) => {
    const { inviteCode } = req.body;
    if (!inviteCode) {
        return res.status(400).json({ error: 'Invite code is missing.' });
    }
    try {
        const restaurantsSnapshot = await firestore.collection('restaurants').get();
        let inviteDoc = null;
        let restaurantId = null;

        for (const restaurant of restaurantsSnapshot.docs) {
            const docRef = firestore.collection('restaurants').doc(restaurant.id).collection('invites').doc(inviteCode);
            const doc = await docRef.get();
            if (doc.exists) {
                inviteDoc = doc;
                restaurantId = restaurant.id;
                break;
            }
        }

        if (!inviteDoc) {
            return res.status(404).json({ error: 'Invite code not found.' });
        }

        if (inviteDoc.data().used) {
            return res.status(400).json({ error: 'This invite has already been used.' });
        }

        res.status(200).json({ restaurantId });
    } catch (error) {
        console.error("Error in /validate-invite:", error);
        res.status(500).json({ error: 'Server error validating invite.' });
    }
});

app.post('/mark-invite-used', async (req, res) => {
    const { inviteCode } = req.body;
    if (!inviteCode) {
        return res.status(400).send('Invite code is missing.');
    }
    try {
        const restaurantsSnapshot = await firestore.collection('restaurants').get();
        let inviteRef = null;

        for (const restaurant of restaurantsSnapshot.docs) {
            const docRef = firestore.collection('restaurants').doc(restaurant.id).collection('invites').doc(inviteCode);
            const doc = await docRef.get();
            if (doc.exists) {
                inviteRef = docRef;
                break;
            }
        }

        if (inviteRef) {
            await inviteRef.update({ used: true });
        }
        res.status(200).send('Invite marked as used.');
    } catch (error) {
        console.error("Error marking invite used:", error);
        res.status(500).send('Server error marking invite as used.');
    }
});


app.listen(port, () => {
  console.log(`Backend server listening on http://localhost:${port}`);
});