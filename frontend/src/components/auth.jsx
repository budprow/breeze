import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import './auth.css';

function Auth({ quizIdToTake }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(true);
  const [error, setError] = useState('');

  const handleAuthAction = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        await setDoc(doc(db, 'users', user.uid), {
          email: user.email,
          role: 'user',
          createdAt: serverTimestamp()
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }

      if (quizIdToTake) {
        window.location.reload();
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
        setError('Could not sign in as a guest. Please try again.');
        console.error("Guest sign-in error:", err);
    }
  };
  
  const title = quizIdToTake ? 'Take the Quiz!' : (isSignUp ? 'Create Your Account' : 'Welcome Back');
  const subtitle = quizIdToTake ? 'Sign up or log in to start.' : (isSignUp ? 'Get started with your personal study sidekick.' : 'Sign in to continue.');

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>{title}</h2>
        <p className="auth-subtitle">{subtitle}</p>
        <form onSubmit={handleAuthAction}>
          <div className="input-group">
            <label htmlFor="email">Email</label>
            <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="error-message">{error}</p>}
          <button type="submit" className="auth-button">
            {isSignUp ? 'Create Account' : 'Log In'}
          </button>
        </form>
        
        {/* THE FIX: Always show the toggle, but hide the guest button for shared quizzes */}
        {!quizIdToTake && (
          <button onClick={handleGuestSignIn} className="guest-button">Try a Demo</button>
        )}
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
