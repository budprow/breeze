import React, { useState, useEffect } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously
} from 'firebase/auth';
import { doc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import axios from 'axios';
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

    if (isSignUp && inviteCode) {
      try {
        const apiUrl = "https://us-central1-breeze-9c703.cloudfunctions.net/api";

        const validationResponse = await axios.post(`${apiUrl}/validate-invite`, { inviteCode });
        const { restaurantId } = validationResponse.data;

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await setDoc(doc(db, 'users', user.uid), {
          email: user.email,
          role: 'employee',
          restaurantId: restaurantId,
          createdAt: serverTimestamp()
        });
        
        await axios.post(`${apiUrl}/mark-invite-used`, { inviteCode });

      } catch (err) {
        setError(err.response?.data?.error || 'Failed to create employee account.');
      }
      return;
    }

    if (isSignUp) {
      if (!restaurantName) {
        setError("Please enter your restaurant's name.");
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
          role: 'manager',
          restaurantId: restaurantRef.id,
          createdAt: serverTimestamp()
        });
      } catch (err) {
        setError(err.message);
      }
      return;
    }
    
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
  
  const title = inviteCode ? 'Join Your Team' : (isSignUp ? 'Create Your Restaurant Account' : 'Welcome Back');
  const subtitle = inviteCode ? 'Create an account to accept the invitation.' : (isSignUp ? 'Get started as a manager.' : 'Sign in to continue.');
  const emailLabel = inviteCode ? 'Your Email' : (isSignUp ? "Manager's Email" : "Email");

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>{title}</h2>
        <p className="auth-subtitle">{subtitle}</p>
        <form onSubmit={handleAuthAction}>
          {isSignUp && !inviteCode && (
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
