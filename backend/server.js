const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const admin = require('firebase-admin');

const app = express();
const port = 3001;

// --- UPDATED MIDDLEWARE CONFIGURATION ---
// This explicit configuration ensures all requests are handled correctly.
app.use(cors({ origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// --- END OF UPDATE ---

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
// --- End of Firebase Admin Initialization ---


// --- ROUTES ---

app.post('/generate-quiz', async (req, res) => {
    // ... your existing quiz generation logic ...
});

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

app.post('/create-invite', verifyFirebaseToken, async (req, res) => {
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

app.post('/validate-invite', async (req, res) => {
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
    console.error("Error in /validate-invite:", error); // Added more detailed logging
    res.status(500).json({ error: 'Server error validating invite.' });
  }
});

app.post('/mark-invite-used', async (req, res) => {
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