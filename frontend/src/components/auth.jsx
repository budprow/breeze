import React, { useState, useEffect } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously
} from 'firebase/auth';
import { doc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import api from '../api'; // Use the centralized API
import './auth.css';

function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [isSignUp, setIsSignUp] = useState(true);
  const [error, setError] = useState('');
  const [inviteCode, setInviteCode] = useState(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('invite');
    if (code) {
      setInviteCode(code);
      setIsSignUp(true);
    }
  }, []);

  const handleAuthAction = async (e) => {
    e.preventDefault();
    setError('');

    // Handle invited user sign-up
    if (isSignUp && inviteCode) {
      try {
        // First, create the user in Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Then, validate the invite and create their profile
        const validationResponse = await api.post('/validate-invite', { inviteCode });
        const { restaurantId } = validationResponse.data;

        await setDoc(doc(db, 'users', user.uid), {
          email: user.email,
          role: 'user',
          restaurantId: restaurantId,
          createdAt: serverTimestamp()
        });
        
        // Finally, mark the invite as used
        await api.post('/mark-invite-used', { inviteCode });

      } catch (err) {
        setError(err.response?.data?.error || 'Failed to create user account.');
      }
      return;
    }

    // Handle new administrator sign-up
    if (isSignUp) {
      if (!restaurantName) {
        setError("Please enter your organization's name.");
        return;
      }
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        const restaurantRef = await addDoc(collection(db, 'restaurants'), {
          name: restaurantName,
          ownerId: user.uid,
          createdAt: serverTimestamp()
        });
        await setDoc(doc(db, 'users', user.uid), {
          email: user.email,
          role: 'administrator',
          restaurantId: restaurantRef.id,
          createdAt: serverTimestamp()
        });
      } catch (err) {
        setError(err.message);
      }
      return;
    }
    
    // Handle standard sign-in
    if (!isSignUp) {
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err) {
            setError(err.message);
        }
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
  
  const title = inviteCode ? 'Join Your Team' : (isSignUp ? 'Create Your Account' : 'Welcome Back');
  const subtitle = inviteCode ? 'Create an account to accept the invitation.' : (isSignUp ? 'Get started as an administrator.' : 'Sign in to continue.');
  const emailLabel = inviteCode ? 'Your Email' : (isSignUp ? "Administrator's Email" : "Email");

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>{title}</h2>
        <p className="auth-subtitle">{subtitle}</p>
        <form onSubmit={handleAuthAction}>
          {isSignUp && !inviteCode && (
            <div className="input-group">
              <label htmlFor="restaurantName">Organization Name</label>
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
