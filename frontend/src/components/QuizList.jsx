import React, { useState, useEffect } from 'react';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, query, where, doc, deleteDoc, getDoc, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';
import './QuizList.css';

function QuizList({ onRetake, onRefine, onShowResults, onShare, onUpdateName }) { 
  const user = auth.currentUser;
  const [quizzesValue, quizzesLoading, quizzesError] = useCollection(
    user ? query(collection(db, 'quizzes'), where('ownerId', '==', user.uid)) : null
  );

  const [editingQuizId, setEditingQuizId] = useState(null);
  const [quizName, setQuizName] = useState('');
  const [attemptCounts, setAttemptCounts] = useState({});

  useEffect(() => {
    if (quizzesValue) {
      quizzesValue.docs.forEach(async (quiz) => {
        const quizData = quiz.data();
        if (quizData.originalQuizId) {
          const resultsRef = collection(db, 'quizzes', quizData.originalQuizId, 'results');
          const q = query(resultsRef, where('takerId', '==', user.uid));
          const querySnapshot = await getDocs(q);
          
          const originalQuizRef = doc(db, 'quizzes', quizData.originalQuizId);
          const originalQuizSnap = await getDoc(originalQuizRef);
          const limit = originalQuizSnap.exists() ? originalQuizSnap.data().attemptLimit || 10 : 10;

          setAttemptCounts(prev => ({ ...prev, [quiz.id]: { count: querySnapshot.size, limit } }));
        }
      });
    }
  }, [quizzesValue, user.uid]);


  const handleDelete = async (quizId) => {
    if (!window.confirm("Are you sure you want to delete this quiz? This cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, 'quizzes', quizId));
    } catch (error) {
      console.error("Error deleting quiz:", error);
      alert("Failed to delete quiz.");
    }
  };
  
  const handleNameEdit = (quiz) => {
    setEditingQuizId(quiz.id);
    setQuizName(quiz.data().documentName);
  };
  
  const handleNameSave = (quizId) => {
    onUpdateName(quizId, quizName);
    setEditingQuizId(null);
  };

  return (
    <div className="quiz-list-container">
      <h3>My Quizzes</h3>
      {quizzesLoading && <span>Loading quizzes...</span>}
      {quizzesError && <strong>Error: {JSON.stringify(quizzesError)}</strong>}
      {quizzesValue && (
        <ul className="list-container">
          {quizzesValue.docs.length === 0 ? (
            <p className="no-items-message">You haven't saved any quizzes yet.</p>
          ) : (
            quizzesValue.docs.map((quiz) => {
              const quizData = quiz.data();
              const isOriginal = !quizData.originalQuizId;
              const attempts = attemptCounts[quiz.id];

              return (
                <li key={quiz.id} className="quiz-item">
                  <div className="quiz-info">
                    {editingQuizId === quiz.id && isOriginal ? (
                      <div className="name-edit-container">
                        <input 
                          type="text" 
                          value={quizName} 
                          onChange={(e) => setQuizName(e.target.value)} 
                          className="name-edit-input"
                        />
                        <button onClick={() => handleNameSave(quiz.id)} className="action-btn save-name-btn">Save</button>
                      </div>
                    ) : (
                      <p className="quiz-name" onClick={() => isOriginal && handleNameEdit(quiz)}>
                        {quizData.documentName}
                      </p>
                    )}
                    <p className="quiz-score">Score: {quizData.score}/{quizData.totalQuestions}</p>
                    <p className="quiz-date">Completed: {new Date(quizData.completedAt?.toDate()).toLocaleDateString()}</p>
                    {!isOriginal && attempts && (
                      <p className="attempt-counter">Attempts: {attempts.count}/{attempts.limit}</p>
                    )}
                  </div>
                  <div className="quiz-actions">
                    <button onClick={() => onRetake(quiz)} className="action-btn retake-btn">Retake</button>
                    <button onClick={() => onRefine(quizData.documentId)} className="action-btn refine-btn">Refine</button>
                    {isOriginal ? (
                      <>
                        <button onClick={() => onShare(quiz)} className="action-btn share-btn">Share</button>
                        <button onClick={() => onShowResults(quiz)} className="action-btn view-results-btn">Results</button>
                      </>
                    ) : (
                      <button onClick={() => onShowResults(quiz)} className="action-btn view-results-btn">Results</button>
                    )}
                    <button onClick={() => handleDelete(quiz.id)} className="action-btn delete-btn">Delete</button>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}

export default QuizList;