import React from 'react';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import './QuizResults.css';

function QuizResults({ quiz, onViewDetails, onClose }) {
  // Query the results sub-collection for the specific quiz
  const resultsRef = collection(db, 'quizzes', quiz.id, 'results');
  const [resultsValue, resultsLoading, resultsError] = useCollection(query(resultsRef, orderBy('completedAt', 'desc')));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Results for "{quiz.data().documentName}"</h3>
        {resultsLoading && <p>Loading results...</p>}
        {resultsError && <p>Error loading results.</p>}
        {resultsValue && (
          <ul className="results-list">
            {resultsValue.docs.length === 0 ? (
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