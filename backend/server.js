const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const admin = require('firebase-admin');
const pdf = require('pdf-parse');

const app = express();
const port = 3001;

if (process.env.NODE_ENV === 'development') {
  console.log('Development environment detected. Pointing to Storage Emulator.');
  process.env['FIREBASE_STORAGE_EMULATOR_HOST'] = '127.0.0.1:9199';
}

app.use(cors({ origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

try {
  const serviceAccount = require('./serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: "breeze-9c703.appspot.com"
  });
  console.log("Firebase Admin SDK initialized successfully.");
} catch (e) {
  console.error("FIREBASE ADMIN SDK INITIALIZATION ERROR:", e);
}
const firestore = admin.firestore();

const geminiApiKey = process.env.GEMINI_API_KEY;
if (!geminiApiKey) {
  console.warn("Gemini API key not found. Quiz generation will fail.");
}
const genAI = new GoogleGenerativeAI(geminiApiKey);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

// ** THIS IS THE ROUTE THAT WAS MISSING **
app.post('/api/generate-quiz', verifyFirebaseToken, async (req, res) => {
    const { text, refinementText } = req.body;
    if (!text) {
        return res.status(400).send("No text provided for quiz generation.");
    }
    const prompt = `
      Based on the following text, generate a multiple-choice quiz with 5 to 8 questions.
      Each question must have exactly 4 answer options, with only one being correct.
      ${refinementText ? `Follow these specific instructions: "${refinementText}".` : ""}
      Format the output as a single JSON object inside a \`\`\`json code block.
      The JSON object should have a single key "questions", which is an array.
      Each object in the "questions" array should have: a "question" key, an "options" key with an array of 4 strings, and a "correctAnswer" key.
      Here is the text to analyze: --- ${text} ---
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

app.post('/api/documents/process', verifyFirebaseToken, async (req, res) => {
  const { documentId, filePath } = req.body;
  if (!documentId || !filePath) {
    return res.status(400).send('Missing documentId or filePath.');
  }
  try {
    const bucket = admin.storage().bucket();
    const file = bucket.file(filePath);
    const [fileBuffer] = await file.download();
    const data = await pdf(fileBuffer);
    const pagesText = data.text.split('\f').filter(page => page.trim().length > 0);
    const fullText = pagesText.join('\n\n--- Page Break ---\n\n');
    const prompt = `
      Read the following text, which is separated by "--- Page Break ---". 
      Identify the 5-10 most important key concepts in the entire document.
      For each concept, return the full, exact sentence in which it is explained.
      Format the output as a single JSON object inside a \`\`\`json code block.
      The JSON object should map the page number (as a string, starting from "1") to an array of the key sentences found on that page.
      Example: { "1": ["Sentence one...", "Sentence two..."], "2": ["Sentence three..."] }
      Here is the text to analyze: --- ${fullText} ---
    `;
    const result = await model.generateContent(prompt);
    const keyConcepts = parseJsonFromAiResponse(result.response.text());
    if (!keyConcepts) {
      throw new Error('Failed to parse key concepts from AI response.');
    }
    const docRef = firestore.collection('users').doc(req.user.uid).collection('documents').doc(documentId);
    await docRef.update({ keyConcepts });
    res.status(200).send('Document processed successfully.');
  } catch (error) {
    console.error("Error processing document:", error);
    res.status(500).send("An error occurred while processing the document.");
  }
});

app.post('/api/highlights', verifyFirebaseToken, async (req, res) => {
  const { documentId, pageNumber, selectedText } = req.body;
  const userId = req.user.uid;

  if (!documentId || !pageNumber || !selectedText) {
    return res.status(400).send('Missing required fields: documentId, pageNumber, or selectedText.');
  }

  try {
    const highlightData = {
      text: selectedText,
      page: pageNumber,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const highlightRef = await firestore
      .collection('users')
      .doc(userId)
      .collection('documents')
      .doc(documentId)
      .collection('highlights')
      .add(highlightData);

    res.status(201).json({ highlightId: highlightRef.id, ...highlightData });
  } catch (error) {
    console.error("Error saving highlight:", error);
    res.status(500).send("An error occurred while saving the highlight.");
  }
});

app.post('/api/document/text', async (req, res) => {
    try {
        const { fileUrl } = req.body;
        if (!fileUrl) {
            return res.status(400).json({ error: 'No file URL provided' });
        }
        const bucket = admin.storage().bucket();
        const decodedUrl = decodeURIComponent(fileUrl);
        const urlObject = new URL(decodedUrl);
        let filePath = urlObject.pathname;
        const objectPathIdentifier = '/o/';
        const pathStartIndex = filePath.indexOf(objectPathIdentifier);
        if (pathStartIndex === -1) {
          throw new Error('Invalid file URL format.');
        }
        filePath = filePath.substring(pathStartIndex + objectPathIdentifier.length);
        const file = bucket.file(filePath);
        const [fileBuffer] = await file.download();
        const data = await pdf(fileBuffer);
        const pages = data.text.split('\f').filter(page => page.trim().length > 0);
        res.status(200).json({ pages });
    } catch (error) {
        console.error("DETAILED ERROR in /api/document/text:", error);
        res.status(500).json({ 
            error: 'Failed to extract text from document.',
            details: error.message 
        });
    }
});

// ... (your other routes like /create-invite, etc. remain the same) ...
app.post('/api/create-invite', verifyFirebaseToken, async (req, res) => {
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

app.post('/api/validate-invite', async (req, res) => {
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

app.post('/api/mark-invite-used', async (req, res) => {
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