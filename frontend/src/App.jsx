import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase'; // Import the auth instance

// Import your main components
import ImageUploader from './ImageUploader';
import Auth from './components/auth';
import './App.css'; // Your existing App.css

function App() {
  const [user, setUser] = useState(null); // To store the logged-in user object
  const [isLoading, setIsLoading] = useState(true); // To handle initial auth state check

  useEffect(() => {
    // This is the Firebase listener for auth state changes.
    // It runs once on load, and again anytime the user logs in or out.
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser); // Set the user state
      setIsLoading(false);  // We're done checking, so stop loading
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []); // The empty dependency array ensures this runs only once

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  // While we're checking for a user, show a loading message
  if (isLoading) {
    return <div className="loading-screen"><h1>Loading...</h1></div>;
  }
  
  return (
    <div className="App">
      {user ? (
        // If a user is logged in, show the main app
        <>
          <header className="app-header">
            {/* Display user info, could be email or "Guest" */}
            <span>Welcome, {user.isAnonymous ? 'Guest' : user.email}</span>
            <button onClick={handleLogout} className="logout-button">Logout</button>
          </header>
          <main className="app-container">
            <ImageUploader />
          </main>
        </>
      ) : (
        // If no user is logged in, show the Authentication component
        <Auth />
      )}
    </div>
  );
}

export default App;