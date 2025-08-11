import React, { useState, useEffect } from 'react';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from './firebase';
import Quiz from './Quiz';
import api from './api';
import './Quiz.css';

function SharedQuiz({ quizId, attemptLimit }) {
  const [quizData, setQuizData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startTime, setStartTime] = useState(null);

  useEffect(() => {
    const fetchQuiz = async () => {
      if (!quizId) {
        setError('No quiz ID provided.');
        setLoading(false);
        return;
      }

      const user = auth.currentUser;
      if (!user) {
          setError('You must be logged in to take this quiz.');
          setLoading(false);
          return;
      }

      try {
        const resultsRef = collection(db, 'quizzes', quizId, 'results');
        const q = query(resultsRef, where('takerId', '==', user.uid));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.size >= attemptLimit) {
            setError('You have reached the maximum number of attempts for this quiz.');
            setLoading(false);
            return;
        }

        const quizRef = doc(db, 'quizzes', quizId);
        const docSnap = await getDoc(quizRef);
        if (docSnap.exists()) {
          setQuizData(docSnap.data().quizData);
        } else {
          setError('Quiz not found.');
        }
      } catch (err) {
        console.error("Error fetching shared quiz:", err);
        setError('An error occurred while loading the quiz.');
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [quizId, attemptLimit]);

  const handleSaveSharedQuiz = async (score, answers) => {
    const endTime = Date.now();
    const durationInSeconds = Math.round((endTime - startTime) / 1000);

    try {
      await api.post('/api/save-shared-quiz-result', {
        quizId: quizId,
        score: score,
        quizData: quizData,
        answers: answers,
        duration: durationInSeconds,
      });
      alert("Your results have been saved!");
      window.location.href = '/';
    } catch (err) {
      console.error("Error saving shared quiz result:", err);
      alert(err.response?.data || "Could not save your quiz result.");
    }
  };

  if (loading) return <div className="loading-screen"><h1>Loading Quiz...</h1></div>;
  if (error) return <div className="quiz-container results-screen"><h2>Error</h2><p>{error}</p></div>;

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
          onQuizStart={() => setStartTime(Date.now())}
        />
      ) : <p>No quiz data found.</p>}
    </div>
  );
}

export default SharedQuiz;