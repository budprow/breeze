import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc } from 'firebase/firestore';
import { useDocumentData } from 'react-firebase-hooks/firestore';
import { auth, db } from './firebase';

import Auth from './components/Auth';
import Dashboard from './components/dashboard';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // MODIFIED: This hook will now ONLY run if the user is not anonymous.
  const [userProfile, profileLoading] = useDocumentData(
    user && !user.isAnonymous ? doc(db, 'users', user.uid) : null
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
  };

  // MODIFIED: The main loading condition is now smarter.
  // It only waits for profileLoading if the user isn't a guest.
  const isLoading = authLoading || (user && !user.isAnonymous && profileLoading);

  if (isLoading) {
    return <div className="loading-screen"><h1>Loading...</h1></div>;
  }
  
  return (
    <div className="App">
      <header className="app-header">
        <h1>AI Training Assistant</h1>
        {user && (
          <div className="user-info">
            <span>{user.isAnonymous ? 'Guest' : user.email}</span>
            <button onClick={handleLogout} className="logout-button">Logout</button>
          </div>
        )}
      </header>
      
      <main className="app-container">
        {user ? (
          // MODIFIED: Pass both the auth user and the profile down to the Dashboard
          <Dashboard user={user} userProfile={userProfile} />
        ) : (
          <Auth />
        )}
      </main>
    </div>
  );
}

export default App;