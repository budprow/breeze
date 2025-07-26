import React from 'react';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, query } from 'firebase/firestore';
import { db } from '../firebase';
import './QuizResults.css'; // We will create this file next

function QuizResults({ quiz, onClose }) {
  const resultsRef = collection(db, 'quizzes', quiz.id, 'results');
  const [resultsValue, resultsLoading, resultsError] = useCollection(query(resultsRef));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Results for "{quiz.data().documentName}"</h3>
        {resultsLoading && <p>Loading results...</p>}
        {resultsError && <p>Error loading results.</p>}
        {resultsValue && (
          <ul>
            {resultsValue.docs.length === 0 ? (
              <p>No one has taken this quiz yet.</p>
            ) : (
              resultsValue.docs.map(doc => (
                <li key={doc.id} className="result-item">
                  <span>{doc.data().takerEmail}</span>
                  <span>Score: {doc.data().score}/{quiz.data().totalQuestions}</span>
                </li>
              ))
            )}
          </ul>
        )}
        <button onClick={onClose} className="action-btn">Close</button>
      </div>
    </div>
  );
}

export default QuizResults;