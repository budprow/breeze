// This file initializes your connection to Firebase.
// It's kept separate for organization and security.

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; 

// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB67qplm4G9N-UBMjgIcHV28PL7Hhb1rHk",
  authDomain: "breeze-9c703.firebaseapp.com",
  projectId: "breeze-9c703",
  storageBucket: "breeze-9c703.firebasestorage.app",
  messagingSenderId: "670243934995",
  appId: "1:670243934995:web:388caf65f9dc13e44100e6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize and export Firebase Authentication
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);