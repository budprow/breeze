import React from 'react';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import './QuizResults.css';

function QuizResults({ quiz, onViewDetails, onClose }) {
  // ** THE FIX: Determine which quiz ID to use for fetching results **
  // If the quiz has an originalQuizId, it's a copy taken by the user.
  // We need to fetch results from the *original* quiz document.
  const resultsQuizId = quiz.data().originalQuizId || quiz.id;

  const resultsRef = collection(db, 'quizzes', resultsQuizId, 'results');
  const [resultsValue, resultsLoading, resultsError] = useCollection(query(resultsRef, orderBy('completedAt', 'desc')));

  const takerQuizData = quiz.data();
  // Check if the current quiz being viewed is a taker's copy.
  const isTakerCopy = !!takerQuizData.originalQuizId;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Results for "{quiz.data().documentName}"</h3>
        {resultsLoading && <p>Loading results...</p>}
        {resultsError && <p>Error loading results.</p>}
        {resultsValue && (
          <ul className="results-list">
            {/* ** THE FIX: If this is a taker's copy, display their result first ** */}
            {isTakerCopy && (
              <li key="my-result" className="result-item my-result">
                <div className="result-info">
                  <span className="taker-email">My Result</span>
                  <span className="taker-score">Score: {takerQuizData.score}/{takerQuizData.totalQuestions}</span>
                  <span className="taker-date">
                    {new Date(takerQuizData.completedAt?.toDate()).toLocaleString()}
                  </span>
                </div>
                <button onClick={() => onViewDetails(takerQuizData)} className="action-btn details-btn">
                  View Details
                </button>
              </li>
            )}

            {resultsValue.docs.length === 0 && !isTakerCopy ? (
              <p>No one has taken this quiz yet.</p>
            ) : (
              resultsValue.docs.map(doc => {
                const result = doc.data();
                return (
                  <li key={doc.id} className="result-item">
                    <div className="result-info">
                      <span className="taker-email">{result.takerEmail}</span>
                      <span className="taker-score">Score: {result.score}/{quiz.data().totalQuestions}</span>
                      <span className="taker-date">
                        {new Date(result.completedAt?.toDate()).toLocaleString()}
                      </span>
                    </div>
                    <button onClick={() => onViewDetails(result)} className="action-btn details-btn">
                      View Details
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        )}
        <button onClick={onClose} className="action-btn close-btn">Close</button>
      </div>
    </div>
  );
}

export default QuizResults;