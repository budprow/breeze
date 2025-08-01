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
  const [attemptLimit, setAttemptLimit] = useState(10);

  const [userProfile, profileLoading] = useDocumentData(
    user && !user.isAnonymous ? doc(db, 'users', user.uid) : null
  );

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const quizIdFromUrl = urlParams.get('quizId');
    const limitFromUrl = urlParams.get('limit');

    if (quizIdFromUrl) {
      setSharedQuizId(quizIdFromUrl);
      if (limitFromUrl) {
        setAttemptLimit(parseInt(limitFromUrl, 10));
      }
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    window.history.pushState({}, '', '/');
    setSharedQuizId(null);
    await signOut(auth);
  };

  const isLoading = authLoading || (user && !user.isAnonymous && profileLoading);
  if (isLoading) return <div className="loading-screen"><h1>Loading...</h1></div>;

  const renderContent = () => {
    if (user && sharedQuizId) {
      return <SharedQuiz quizId={sharedQuizId} attemptLimit={attemptLimit} />;
    }
    if (!user && sharedQuizId) {
      return <Auth quizIdToTake={sharedQuizId} />;
    }
    if (user) {
      return <Dashboard user={user} />;
    }
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