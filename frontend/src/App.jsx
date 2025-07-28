import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc } from 'firebase/firestore';
import { useDocumentData } from 'react-firebase-hooks/firestore';
import { auth, db } from './firebase';

import Auth from './components/auth';
import Dashboard from './components/Dashboard';
import SharedQuiz from './SharedQuiz';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [sharedQuizId, setSharedQuizId] = useState(null);

  const [userProfile, profileLoading] = useDocumentData(
    user && !user.isAnonymous ? doc(db, 'users', user.uid) : null
  );

  useEffect(() => {
    // On initial load, check the URL for a quizId
    const urlParams = new URLSearchParams(window.location.search);
    const quizIdFromUrl = urlParams.get('quizId');
    if (quizIdFromUrl) {
      setSharedQuizId(quizIdFromUrl);
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    // When logging out, clear the URL and any shared quiz ID
    window.history.pushState({}, '', '/');
    setSharedQuizId(null);
    await signOut(auth);
  };

  const isLoading = authLoading || (user && !user.isAnonymous && profileLoading);

  if (isLoading) {
    return <div className="loading-screen"><h1>Loading...</h1></div>;
  }

  const renderContent = () => {
    // ** THE FIX: This logic ensures correct routing for shared quizzes **

    // 1. If a user is logged in AND there's a sharedQuizId, show the quiz.
    if (user && sharedQuizId) {
      return <SharedQuiz quizId={sharedQuizId} />;
    }
    
    // 2. If there's a sharedQuizId but NO user, show the Auth page.
    //    We pass the quizId so it knows to redirect after login.
    if (!user && sharedQuizId) {
      return <Auth quizIdToTake={sharedQuizId} />;
    }

    // 3. If there's a user but NO sharedQuizId, show the normal dashboard.
    if (user) {
      return <Dashboard user={user} />;
    }
    
    // 4. If no user and no sharedQuizId, show the standard Auth page.
    return <Auth />;
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