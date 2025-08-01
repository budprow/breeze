import React from 'react';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, query, where, doc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import './QuizList.css';

function QuizList({ onRetake, onRefine, onShowResults, onShare }) { 
  const user = auth.currentUser;
  
  const [quizzesValue, quizzesLoading, quizzesError] = useCollection(
    user ? query(collection(db, 'quizzes'), where('ownerId', '==', user.uid)) : null
  );

  const handleDelete = async (quizId) => {
    if (!window.confirm("Are you sure you want to delete this quiz? This cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, 'quizzes', quizId));
    } catch (error) {
      console.error("Error deleting quiz:", error);
      alert("Failed to delete quiz.");
    }
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
              return (
                <li key={quiz.id} className="quiz-item">
                  <div className="quiz-info">
                    <p className="quiz-name">{quizData.documentName}</p>
                    <p className="quiz-score">Score: {quizData.score}/{quizData.totalQuestions}</p>
                    <p className="quiz-date">Completed: {new Date(quizData.completedAt?.toDate()).toLocaleDateString()}</p>
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