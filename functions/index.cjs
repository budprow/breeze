const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const functions = require("firebase-functions");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { onRequest } = require("firebase-functions/v2/https");
const { FieldValue } = require("firebase-admin/firestore");
const quizGenerator = require("./services/quizGenerator.cjs");
const pdf = require("pdf-parse");
require("dotenv").config();

if (process.env.FUNCTIONS_EMULATOR === "true") {
  console.log("Local emulator detected! Connecting Admin SDK to emulators.");
  process.env.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";
}

admin.initializeApp();
const db = admin.firestore();
const app = express();

app.use(cors({ origin: true }));
app.use(express.json());

const geminiApiKey = process.env.GEMINI_API_KEY || (functions.config().gemini && functions.config().gemini.key);
let genAI;
if (geminiApiKey) {
  genAI = new GoogleGenerativeAI(geminiApiKey);
} else {
  console.warn("GEMINI_API_KEY not found. Some endpoints will not work.");
}

const parseJsonFromAiResponse = (rawText) => {
  const match = rawText.match(/```json\n([\s\S]*?)\n```/);
  if (!match || !match[1]) {
    console.error("Could not find a JSON code block in the AI response.");
    return null;
  }
  try {
    const sanitizedJson = match[1].replace(/[\x00-\x1F\x7F-\x9F]/g, "");
    return JSON.parse(sanitizedJson);
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

app.post("/documents/process", verifyFirebaseToken, async (req, res) => {
  const { documentId, filePath } = req.body;
  if (!documentId || !filePath) {
    return res.status(400).send('Missing documentId or filePath.');
  }
  if (!genAI) {
    return res.status(500).send("Server is not configured with a Gemini API key.");
  }
  try {
    const bucket = admin.storage().bucket();
    const file = bucket.file(filePath);
    const [fileBuffer] = await file.download();
    const data = await pdf(fileBuffer);
    
    // --- THIS IS THE FIX ---
    // 1. Split the document text into pages based on the form feed character.
    const pagesText = data.text.split('\f').filter(page => page.trim().length > 0);
    // 2. Join the pages with a clear separator for the AI.
    const fullTextWithSeparators = pagesText.join('\n\n--- Page Break ---\n\n');

    const prompt = `
      Read the following text, which is separated by "--- Page Break ---". 
      Identify the 5-10 most important key concepts in the entire document.
      For each concept, return the full, exact sentence in which it is explained.
      Format the output as a single JSON object inside a \`\`\`json code block.
      The JSON object should map the page number (as a string, starting from "1") to an array of the key sentences found on that page.
      Use the "--- Page Break ---" separators to determine the page number for each sentence.
      Example: { "1": ["Sentence one...", "Sentence two..."], "2": ["Sentence three..."] }
      Here is the text to analyze:
      ---
      ${fullTextWithSeparators}
      ---
    `;
    
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const keyConcepts = parseJsonFromAiResponse(result.response.text());
    
    if (!keyConcepts) {
      throw new Error('Failed to parse key concepts from AI response.');
    }
    
    const docRef = db.collection('users').doc(req.user.uid).collection('documents').doc(documentId);
    await docRef.update({ keyConcepts });
    
    res.status(200).send('Document processed successfully.');
  } catch (error) {
    console.error("Error processing document:", error);
    res.status(500).send("An error occurred while processing the document.");
  }
});

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

// (The rest of your routes: /save-quiz, /save-shared-quiz-result, etc. remain here)
app.post("/save-quiz", verifyFirebaseToken, async (req, res) => {
  const { quizData, score, documentName, documentId, answers } = req.body;
  const userId = req.user.uid;

  if (!quizData || score === undefined || !documentName || !documentId || !answers) {
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
      answers: answers
    });
    res.status(201).send("Quiz saved successfully.");
  } catch (error) {
    console.error("Error saving quiz:", error);
    res.status(500).send("Server error while saving quiz.");
  }
});

app.post("/save-shared-quiz-result", verifyFirebaseToken, async (req, res) => {
  const { quizId, score, quizData, answers, duration } = req.body;
  const { uid, email } = req.user;

  if (!quizId || score === undefined || !quizData || !answers || duration === undefined) {
    return res.status(400).send("Missing required data.");
  }

  try {
    const originalQuizRef = db.collection('quizzes').doc(quizId);
    const resultsRef = originalQuizRef.collection('results');

    const originalQuizSnap = await originalQuizRef.get();
    if (!originalQuizSnap.exists) {
      return res.status(404).send("Original quiz not found.");
    }


   const takerQuizQuery = db.collection('quizzes')
      .where('ownerId', '==', uid)
      .where('originalQuizId', '==', quizId)
      .limit(1);
    const takerQuizSnap = await takerQuizQuery.get();

    await db.runTransaction(async (transaction) => {
      const quizDocData = originalQuizSnap.data();
      const limit = quizDocData.attemptLimit || 10;
      const userAttemptsQuery = resultsRef.where('takerId', '==', uid);
      const userAttemptsSnap = await transaction.get(userAttemptsQuery);
      if (userAttemptsSnap.size >= limit) {
        throw new Error("You have reached the maximum number of attempts.");
      }

      const newResultRef = resultsRef.doc();
      transaction.set(newResultRef, {
        takerId: uid,
        takerEmail: email,
        score: score,
        totalQuestions: quizData.length,
        completedAt: FieldValue.serverTimestamp(),
        answers: answers,
        duration: duration
      });
      if (takerQuizSnap.empty) {
        const newTakerQuizRef = db.collection('quizzes').doc();
        transaction.set(newTakerQuizRef, {
          ownerId: uid,
          documentId: quizDocData.documentId,
          documentName: quizDocData.documentName,
          score: score,
          totalQuestions: quizData.length,
          quizData: quizData,
          completedAt: FieldValue.serverTimestamp(),
          originalQuizId: quizId,
          answers: answers,
          duration: duration
        });
      } else {
        const takerQuizDocRef = takerQuizSnap.docs[0].ref;
        transaction.update(takerQuizDocRef, {
          score: score,
          completedAt: FieldValue.serverTimestamp(),
          answers: answers,
          duration: duration
        });
      }
    });

    res.status(201).send("Quiz result saved successfully.");
  } catch (error) {
    console.error("Error saving shared quiz result:", error.message);
    if (error.message.includes("maximum number of attempts")) {
      return res.status(403).send(error.message);
    }
    res.status(500).send("Could not save your quiz result due to a server error.");
  }
});

app.post('/update-quiz-name', verifyFirebaseToken, async (req, res) => {
  const { quizId, newName } = req.body;
  const userId = req.user.uid;

  if (!quizId || !newName) {
    return res.status(400).send("Missing quiz ID or new name.");
  }

  try {
    const quizRef = db.collection('quizzes').doc(quizId);
    const quizSnap = await quizRef.get();

    if (!quizSnap.exists) {
      return res.status(404).send("Quiz not found.");
    }
    if (quizSnap.data().ownerId !== userId) {
      return res.status(403).send("You are not authorized to edit this quiz.");
    }

    await quizRef.update({ documentName: newName });
    res.status(200).send("Quiz name updated successfully.");

  } catch (error) {
    console.error("Error updating quiz name:", error);
    res.status(500).send("Server error while updating quiz name.");
  }
});

app.post('/create-invite', verifyFirebaseToken, async (req, res) => {
    const { restaurantId } = req.body;
    const managerId = req.user.uid;
    if (!restaurantId || !managerId) {
        return res.status(400).send('Missing restaurantId or managerId.');
    }
    try {
      const inviteRef = await db.collection('restaurants').doc(restaurantId).collection('invites').add({
        createdAt: FieldValue.serverTimestamp(),
        used: false,
        createdBy: managerId,
      });

      res.status(201).json({ inviteCode: inviteRef.id });
    } catch (error) {
      console.error("Error creating invite:", error);
      res.status(500).send('Server error while creating invite.');
    }
  });

exports.api = onRequest({ secrets: ["GEMINI_API_KEY"] }, app);
