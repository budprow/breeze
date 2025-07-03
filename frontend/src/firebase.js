import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";

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

// Initialize services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Connect to Emulators if running locally
if (window.location.hostname === "localhost") {
  console.log("Connecting to local Firebase emulators...");
  connectAuthEmulator(auth, "http://localhost:9099");
  connectFirestoreEmulator(db, "localhost", 8080);
  connectStorageEmulator(storage, "localhost", 9199);
}

// Export services
export { auth, db, storage };