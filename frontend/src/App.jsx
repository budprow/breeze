import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc } from 'firebase/firestore';
import { useDocumentData } from 'react-firebase-hooks/firestore';
import { auth, db } from './firebase';
import ActiveReader from './components/ActiveReader'; // Import the new component
import Auth from './components/auth';
import Dashboard from './components/Dashboard';
import SharedQuiz from './SharedQuiz';
import MyNotes from './components/MyNotes';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [sharedQuizId, setSharedQuizId] = useState(null);
  const [attemptLimit, setAttemptLimit] = useState(10);
  
  // --- CHANGE #1: Add new state to track the Active Reader URL ---
  const [activeReaderFileUrl, setActiveReaderFileUrl] = useState(null);
  const [notesDocumentId, setNotesDocumentId] = useState(null);

  const [userProfile, profileLoading] = useDocumentData(
    user && !user.isAnonymous ? doc(db, 'users', user.uid) : null
  );

  useEffect(() => {
    // --- CHANGE #2: Check the URL path for "/read/" when the app loads ---
    const path = window.location.pathname;
    if (path.startsWith('/read/')) {
        // If the path starts with /read/, we know we need to show the reader.
        // We grab the file URL from the path.
        const encodedUrl = path.substring(6); // Gets everything after "/read/"
        if (encodedUrl) {
            setActiveReaderFileUrl(decodeURIComponent(encodedUrl));
        }
    } else if (path.startsWith('/notes/')) {
        const docId = path.substring(7);
        if (docId) {
            setNotesDocumentId(docId);
        }
    }else {
        // This is your original logic for handling shared quiz links. It will only
        // run if the URL is NOT an active reader URL.
        const urlParams = new URLSearchParams(window.location.search);
        const quizIdFromUrl = urlParams.get('quizId');
        const limitFromUrl = urlParams.get('limit');

        if (quizIdFromUrl) {
          setSharedQuizId(quizIdFromUrl);
          if (limitFromUrl) {
            setAttemptLimit(parseInt(limitFromUrl, 10));
          }
        }
    }


    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    // When logging out, ensure we clear any special page states
    window.history.pushState({}, '', '/');
    setSharedQuizId(null);
    setActiveReaderFileUrl(null); 
    setNotesDocumentId(null);
    await signOut(auth);
  };

  const isLoading = authLoading || (user && !user.isAnonymous && profileLoading);
  if (isLoading) return <div className="loading-screen"><h1>Loading...</h1></div>;

  const renderContent = () => {
    // --- CHANGE #3: Add a new rule to show the ActiveReader first ---
    // If a user is logged in and the activeReaderFileUrl is set, show the reader.
    if (user && activeReaderFileUrl) {
      return <ActiveReader />;
    }

    if (user && notesDocumentId) {
        return <MyNotes documentId={notesDocumentId} />;
    }

    // The rest of your rendering logic remains exactly the same.
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
