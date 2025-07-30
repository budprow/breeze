import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import Quiz from './Quiz';
import api from './api';
import './Quiz.css';

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

  const handleSaveSharedQuiz = async (score, answers) => {
    try {
      await api.post('/save-shared-quiz-result', {
        quizId: quizId,
        score: score,
        quizData: quizData,
        answers: answers
      });
      alert("Your results have been saved!");
      window.location.href = '/';
    } catch (err) {
      console.error("Error saving shared quiz result:", err);
      alert("Could not save your quiz result.");
    }
  };

  if (loading) {
    return <div className="loading-screen"><h1>Loading Quiz...</h1></div>;
  }

  if (error) {
    return <div className="quiz-container results-screen"><h2>Error</h2><p>{error}</p></div>;
  }

  return (
    <div>
      {quizData ? (
        <Quiz
          quizData={quizData}
          onSaveAndExit={handleSaveSharedQuiz}
          onRegenerate={() => {}} 
          onExitWithoutSaving={() => window.location.href = '/'}
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