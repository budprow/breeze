import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import Quiz from './Quiz';
import './Quiz.css'; // Re-use the existing quiz styles

function SharedQuiz({ quizId }) {
  const [quizData, setQuizData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchQuiz = async () => {
      if (!quizId) {
        setError('No quiz ID provided.');
        setLoading(false);
        return;
      }
      try {
        const quizRef = doc(db, 'quizzes', quizId);
        const docSnap = await getDoc(quizRef);
        if (docSnap.exists()) {
          setQuizData(docSnap.data().quizData);
        } else {
          setError('Quiz not found. The link may be invalid or the quiz may have been deleted.');
        }
      } catch (err) {
        console.error("Error fetching shared quiz:", err);
        setError('An error occurred while loading the quiz.');
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [quizId]);

  if (loading) {
    return <div className="loading-screen"><h1>Loading Quiz...</h1></div>;
  }

  if (error) {
    return <div className="quiz-container results-screen"><h2>Error</h2><p>{error}</p></div>;
  }

  // A simple handler for when the shared quiz is completed.
  const onQuizComplete = () => {
    // In a real app, you might direct them to sign up.
    // For now, we'll just show an alert.
    alert("Thanks for taking the quiz! Sign up to create your own.");
  };

  return (
    <div>
      {quizData ? (
        <Quiz
          quizData={quizData}
          onSaveAndExit={onQuizComplete}
          onRegenerate={() => {}} // Not applicable for shared quizzes
          onExitWithoutSaving={onQuizComplete}
          refinementText=""
          setRefinementText={() => {}}
        />
      ) : (
        <p>No quiz data found.</p>
      )}
    </div>
  );
}

export default SharedQuiz;