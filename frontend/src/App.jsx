import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc } from 'firebase/firestore';
import { useDocumentData } from 'react-firebase-hooks/firestore';
import { auth, db } from './firebase';

import Auth from './components/auth';
import Dashboard from './components/Dashboard'; 
import ImageUploader from './ImageUploader'; // The component for guests/demo
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // This hook now correctly depends on 'user' not being null or anonymous
  const [userProfile, profileLoading] = useDocumentData(
    user && !user.isAnonymous ? doc(db, 'users', user.uid) : null
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        await currentUser.getIdToken(true); // Keep this for custom claims later
      }
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
  };

  const isLoading = authLoading || (user && !user.isAnonymous && profileLoading);

  if (isLoading) {
    return <div className="loading-screen"><h1>Loading...</h1></div>;
  }

  // --- THIS IS THE CORRECTED LOGIC ---
  const renderContent = () => {
    // If there's no user, show the Auth page
    if (!user) {
      return <Auth />;
    }
    // If the user is a guest (Try a Demo), show the ImageUploader
    if (user.isAnonymous) {
      return <ImageUploader />;
    }
    // If the user is fully logged in, show their Dashboard
    return <Dashboard user={user} userProfile={userProfile} />;
  };
  
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
        {renderContent()}
      </main>
    </div>
  );
}

export default App;