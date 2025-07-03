const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const admin = require('firebase-admin');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

try {
  const serviceAccount = require('./serviceAccountKey.json');

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  console.log("Firebase Admin SDK initialized successfully for project:", serviceAccount.project_id);

} catch (e) {
  console.error("FIREBASE ADMIN SDK INITIALIZATION ERROR:", e);
  console.error("This can happen if your serviceAccountKey.json is missing or corrupt.");
}

// This is the most important part of the fix.
// We get the firestore instance AFTER initialization and explicitly
// point it to the emulator.
const firestore = admin.firestore();
if (process.env.FIRESTORE_EMULATOR_HOST) {
    console.log(`Connecting to Firestore emulator at: ${process.env.FIRESTORE_EMULATOR_HOST}`);
    firestore.settings({
        host: process.env.FIRESTORE_EMULATOR_HOST,
        ssl: false
    });
}

const parseJsonFromAiResponse = (rawText) => { /* ... function remains the same ... */ };

app.post('/generate-quiz', async (req, res) => { /* ... function remains the same ... */ });

// --- NEW, SIMPLIFIED INVITE ENDPOINTS ---

// This middleware verifies the user token for protected routes
const verifyFirebaseToken = async (req, res, next) => {
  const idToken = req.headers.authorization?.split('Bearer ')[1];
  if (!idToken) return res.status(401).send('Unauthorized');
  try {
    req.user = await admin.auth().verifyIdToken(idToken);
    next();
  } catch (error) {
    res.status(403).send('Could not verify token');
  }
};

// Endpoint for a manager to create an invite code
app.all('/create-invite', verifyFirebaseToken, async (req, res) => {
  const { restaurantId } = req.body;
  const managerId = req.user.uid;
  try {
    const inviteRef = await firestore.collection('restaurants').doc(restaurantId).collection('invites').add({
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      used: false,
      createdBy: managerId,
    });
    res.status(201).json({ inviteCode: inviteRef.id });
  } catch (error) {
    res.status(500).send('Server error while creating invite.');
  }
});

// Endpoint for the frontend to validate an invite code before creating a user
app.all('/validate-invite', async (req, res) => {
  const { inviteCode } = req.body;
  try {
    const invitesQuery = await firestore.collectionGroup('invites').where(admin.firestore.FieldPath.documentId(), '==', inviteCode).get();
    if (invitesQuery.empty) {
      return res.status(404).json({ error: 'Invite code not found.' });
    }
    const inviteDoc = invitesQuery.docs[0];
    if (inviteDoc.data().used) {
      return res.status(400).json({ error: 'This invite has already been used.' });
    }
    const restaurantId = inviteDoc.ref.parent.parent.id;
    res.status(200).json({ restaurantId });
  } catch (error) {
    res.status(500).json({ error: 'Server error validating invite.' });
  }
});

// Endpoint to mark an invite as used after successful employee creation
app.all('/mark-invite-used', async (req, res) => {
    const { inviteCode } = req.body;
    try {
        const invitesQuery = await firestore.collectionGroup('invites').where(admin.firestore.FieldPath.documentId(), '==', inviteCode).get();
        if (!invitesQuery.empty) {
            const inviteDoc = invitesQuery.docs[0];
            await inviteDoc.ref.update({ used: true });
        }
        res.status(200).send('Invite marked as used.');
    } catch (error) {
        res.status(500).send('Server error marking invite as used.');
    }
});


app.listen(port, () => {
  console.log(`Backend server listening on http://localhost:${port}`);
});