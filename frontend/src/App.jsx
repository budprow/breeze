import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc } from 'firebase/firestore';
import { useDocumentData } from 'react-firebase-hooks/firestore';
import { auth, db } from './firebase';

import Auth from './components/auth';
import Dashboard from './components/Dashboard';
import SharedQuiz from './SharedQuiz'; // Import the new component
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [quizId, setQuizId] = useState(null);

  const [userProfile, profileLoading] = useDocumentData(
    user && !user.isAnonymous ? doc(db, 'users', user.uid) : null
  );

  useEffect(() => {
    // Check for a quiz ID in the URL on initial load
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('quizId');
    if (code) {
      setQuizId(code);
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
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

  const renderContent = () => {
    // If a quizId is in the URL, show the shared quiz
    if (quizId) {
      return <SharedQuiz quizId={quizId} />;
    }
    
    // Otherwise, show the normal app flow
    if (!user) {
      return <Auth />;
    }
    return <Dashboard user={user} />;
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