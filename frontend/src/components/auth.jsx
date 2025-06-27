import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously
} from 'firebase/auth';
import { doc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore'; // Import Firestore functions
import { auth, db } from '../firebase'; // Import auth and the new db instance
import './Auth.css';

function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [restaurantName, setRestaurantName] = useState(''); // New state for restaurant name
  const [isSignUp, setIsSignUp] = useState(true);
  const [error, setError] = useState('');

  const handleAuthAction = async (e) => {
    e.preventDefault();
    setError('');

    if (isSignUp && !restaurantName) {
        setError("Please enter your restaurant's name.");
        return;
    }

    try {
      if (isSignUp) {
        // 1. Create the user in Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. Create a new restaurant document in Firestore
        const restaurantRef = await addDoc(collection(db, 'restaurants'), {
          name: restaurantName,
          ownerId: user.uid,
          createdAt: serverTimestamp()
        });

        // 3. Create the user's profile in the 'users' collection with their role
        await setDoc(doc(db, 'users', user.uid), {
          email: user.email,
          role: 'manager',
          restaurantId: restaurantRef.id,
          createdAt: serverTimestamp()
        });

      } else {
        // Login logic remains the same
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleGuestSignIn = async () => {
    setError('');
    try {
      await signInAnonymously(auth);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>{isSignUp ? 'Create Your Restaurant Account' : 'Welcome Back'}</h2>
        <form onSubmit={handleAuthAction}>
          {isSignUp && ( // Only show this field on the sign-up form
            <div className="input-group">
              <label htmlFor="restaurantName">Restaurant Name</label>
              <input
                type="text"
                id="restaurantName"
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                placeholder="e.g., The Salty Spoon"
                required
              />
            </div>
          )}
          <div className="input-group">
            <label htmlFor="email">Manager's Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
            />
          </div>
          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="6+ characters"
            />
          </div>
          {error && <p className="error-message">{error}</p>}
          <button type="submit" className="auth-button">
            {isSignUp ? 'Create Account' : 'Log In'}
          </button>
        </form>
        <button onClick={handleGuestSignIn} className="guest-button">
          Try a Demo
        </button>
        <div className="toggle-auth">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}
          <button onClick={() => setIsSignUp(!isSignUp)} className="toggle-button">
            {isSignUp ? 'Log In' : 'Sign Up'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Auth;