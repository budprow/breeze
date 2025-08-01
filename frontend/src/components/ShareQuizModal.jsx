import React, { useState } from 'react';
import './ShareQuizModal.css'; // We'll create this CSS file next

function ShareQuizModal({ quiz, onShare, onClose }) {
  const [limit, setLimit] = useState(10);

  const handleShareClick = () => {
    const shareableLink = `${window.location.origin}?quizId=${quiz.id}&limit=${limit}`;
    navigator.clipboard.writeText(shareableLink)
      .then(() => {
        alert("Shareable link copied to clipboard!");
        onShare(quiz.id, limit); // Pass the limit back to the dashboard
        onClose();
      })
      .catch(err => {
        console.error('Could not copy text: ', err);
        alert('Failed to copy link.');
      });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Share "{quiz.data().documentName}"</h3>
        <div className="share-settings">
          <label htmlFor="attempt-limit">Set Max Attempts (1-10):</label>
          <input
            id="attempt-limit"
            type="number"
            min="1"
            max="10"
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value, 10))}
            className="attempt-limit-input"
          />
        </div>
        <button onClick={handleShareClick} className="action-btn share-btn-modal">
          Copy Link and Share
        </button>
        <button onClick={onClose} className="action-btn close-btn">
          Cancel
        </button>
      </div>
    </div>
  );
}

export default ShareQuizModal;