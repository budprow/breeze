import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, signInAnonymously } from 'firebase/auth';
import { doc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import axios from 'axios';
import './Auth.css';

function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [isSignUp, setIsSignUp] = useState(true);
  const [error, setError] = useState('');
  
  // NEW: State to hold an invite code found in the URL
  const [inviteCode, setInviteCode] = useState(null);

  // NEW: This effect runs once when the component loads to check for an invite code
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('invite');
    if (code) {
      setInviteCode(code);
      setIsSignUp(true); // Force to sign-up mode if there's an invite
    }
  }, []); // Empty array means this runs only on component mount

  const handleAuthAction = async (e) => {
    e.preventDefault();
    setError('');

    // If it's an employee signing up with an invite code
    if (isSignUp && inviteCode) {
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
            await axios.post(`${apiUrl}/complete-invite`, { email, password, inviteCode });
            // After successful creation, log them in
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create employee account.');
        }
        return;
    }

    // Existing manager sign-up logic
    if (isSignUp && !restaurantName) {
      setError("Please enter your restaurant's name.");
      return;
    }

    try {
      if (isSignUp) {
        // ... (This manager creation logic is unchanged) ...
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleGuestSignIn = async () => { /* ... unchanged ... */ };
  
  // Dynamically change UI content based on whether it's an invite sign-up
  const title = inviteCode ? 'Join Your Team' : (isSignUp ? 'Create Your Restaurant Account' : 'Welcome Back');
  const subtitle = inviteCode ? 'Create an account to accept the invitation.' : (isSignUp ? 'Get started as a manager.' : 'Sign in to continue.');
  const emailLabel = inviteCode ? 'Your Email' : (isSignUp ? "Manager's Email" : "Email");

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>{title}</h2>
        <p className="auth-subtitle">{subtitle}</p>
        <form onSubmit={handleAuthAction}>
          {isSignUp && !inviteCode && ( // Hide restaurant name for invite sign-ups
            <div className="input-group">
              <label htmlFor="restaurantName">Restaurant Name</label>
              <input type="text" id="restaurantName" value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} required />
            </div>
          )}
          <div className="input-group">
            <label htmlFor="email">{emailLabel}</label>
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
        
        {/* Hide other options during an invite sign-up for clarity */}
        {!inviteCode && (
            <>
                <button onClick={handleGuestSignIn} className="guest-button">Try a Demo</button>
                <div className="toggle-auth">
                    {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                    <button onClick={() => setIsSignUp(!isSignUp)} className="toggle-button">
                        {isSignUp ? 'Log In' : 'Sign Up'}
                    </button>
                </div>
            </>
        )}
      </div>
    </div>
  );
}

export default Auth;