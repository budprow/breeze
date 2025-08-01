import React, { useState } from 'react';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { db, auth } from '../firebase';
import './QuizResults.css';

function QuizResults({ quiz, onViewDetails, onClose }) {
  const [openDropdown, setOpenDropdown] = useState(null);

  const resultsQuizId = quiz.data().originalQuizId || quiz.id;
  const isTakerCopy = !!quiz.data().originalQuizId;
  const currentUser = auth.currentUser;

  const resultsRef = collection(db, 'quizzes', resultsQuizId, 'results');
  let resultsQuery = query(resultsRef, orderBy('completedAt', 'desc'));
  
  // If the user is a taker viewing their own results, only fetch their attempts
  if (isTakerCopy) {
    resultsQuery = query(resultsQuery, where('takerId', '==', currentUser.uid));
  }

  const [resultsValue, resultsLoading, resultsError] = useCollection(resultsQuery);

  const groupedResults = resultsValue?.docs.reduce((acc, doc) => {
    const result = { id: doc.id, ...doc.data() };
    const takerEmail = result.takerEmail;
    if (!acc[takerEmail]) {
      acc[takerEmail] = [];
    }
    acc[takerEmail].push(result);
    return acc;
  }, {});

  const formatDuration = (seconds) => {
    if (seconds === undefined) return 'N/A';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const toggleDropdown = (email) => {
    setOpenDropdown(openDropdown === email ? null : email);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Results for "{quiz.data().documentName}"</h3>
        {resultsLoading && <p>Loading results...</p>}
        {resultsError && <p>Error loading results: {resultsError.message}</p>}
        
        <div className="results-list">
          {groupedResults && Object.keys(groupedResults).length === 0 ? (
            <p>No one has taken this quiz yet.</p>
          ) : (
            groupedResults && Object.entries(groupedResults).map(([email, attempts]) => (
              <div key={email} className="result-group">
                <div className="result-group-header" onClick={() => toggleDropdown(email)}>
                  <span>{isTakerCopy ? "My Attempts" : email}</span>
                  <span className={`dropdown-arrow ${openDropdown === email ? 'open' : ''}`}>▼</span>
                </div>
                {openDropdown === email && (
                  <div className="dropdown-content">
                    {attempts.map(attempt => (
                      <div key={attempt.id} className="result-item">
                        <div className="result-info">
                          <span>Score: {attempt.score}/{attempt.totalQuestions}</span>
                          <span className="attempt-details">
                            {new Date(attempt.completedAt.toDate()).toLocaleString()} | Duration: {formatDuration(attempt.duration)}
                          </span>
                        </div>
                        <button onClick={() => onViewDetails(attempt)} className="action-btn details-btn">
                          View Details
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        
        <button onClick={onClose} className="action-btn close-btn">Close</button>
      </div>
    </div>
  );
}

export default QuizResults;