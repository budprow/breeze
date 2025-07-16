import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import './auth.css';

function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSigningUp, setIsSigningUp] = useState(false); // State to show signup form
  const [error, setError] = useState('');

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Create a simple user profile document
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        createdAt: serverTimestamp(),
        // No role or restaurantId needed anymore
      });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
        setError(err.message);
    }
  };

  const handleGuestSignIn = async () => {
    setError('');
    try {
        await signInAnonymously(auth);
    } catch (err) {
        setError('Could not sign in as a guest. Please try again.');
    }
  };

  // If the user chooses to sign up, show the registration form
  if (isSigningUp) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h2>Create Your Account</h2>
          <p className="auth-subtitle">Get started with your own Study Buddy account.</p>
          <form onSubmit={handleCreateAccount}>
            <div className="input-group">
              <label htmlFor="email">Email</label>
              <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="input-group">
              <label htmlFor="password">Password</label>
              <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && <p className="error-message">{error}</p>}
            <button type="submit" className="auth-button">Create Account</button>
            <button onClick={() => setIsSigningUp(false)} className="toggle-button">
                Already have an account? Log In
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Default view: Login / Main choices
  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Welcome to Study Buddy</h2>
        <p className="auth-subtitle">Log in to continue your session.</p>
        <form onSubmit={handleLogin}>
          <div className="input-group">
            <label htmlFor="email">Email</label>
            <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="error-message">{error}</p>}
          <button type="submit" className="auth-button">Log In</button>
        </form>
        
        <div className="separator">or</div>

        <button onClick={() => setIsSigningUp(true)} className="secondary-button">
          Create an Account
        </button>
        <button onClick={handleGuestSignIn} className="guest-button">
          Try a Demo
        </button>
      </div>
    </div>
  );
}

export default Auth;
