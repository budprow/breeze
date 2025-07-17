import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc } from 'firebase/firestore';
import { useDocumentData } from 'react-firebase-hooks/firestore';
import { auth, db } from './firebase';

import Auth from './components/auth';
import Dashboard from './components/Dashboard';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [userProfile, profileLoading] = useDocumentData(
    user && !user.isAnonymous ? doc(db, 'users', user.uid) : null
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        await currentUser.getIdToken(true);
      }
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
  };

  // The main loading screen now waits for BOTH auth and profile to be ready.
  const isLoading = authLoading || (user && !user.isAnonymous && profileLoading);

  if (isLoading) {
    return <div className="loading-screen"><h1>Loading Your Workspace...</h1></div>;
  }

  return (
    <div className="App">
      <header className="app-header">
        <h1>Study Buddy</h1>
        {user && (
          <div className="user-info">
            <span>{user.isAnonymous ? 'Guest' : user.email}</span>
            <button onClick={handleLogout} className="logout-button">Logout</button>
          </div>
        )}
      </header>
      
      <main className="app-container">
        {/* We now pass profileLoading down to the Dashboard component */}
        {user ? <Dashboard user={user} userProfile={userProfile} profileLoading={profileLoading} /> : <Auth />}
      </main>
    </div>
  );
}

export default App;