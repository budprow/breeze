import React from 'react';
import './QuizAttemptDetails.css';

function QuizAttemptDetails({ result, quizData, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content-details" onClick={(e) => e.stopPropagation()}>
        <h3>Quiz Details for {result.takerEmail}</h3>
        <p>Final Score: {result.score}/{quizData.totalQuestions}</p>
        
        <div className="question-list">
          {quizData.quizData.map((question, index) => {
            const userAnswer = result.answers[index];
            const isCorrect = userAnswer === question.correctAnswer;

            return (
              <div key={index} className="question-details-block">
                <p className="question-text-details">{index + 1}. {question.question}</p>
                <div className="options-details-container">
                  {question.options.map((option, optionIndex) => {
                    let className = 'option-detail';
                    if (option === question.correctAnswer) {
                      className += ' correct-answer';
                    }
                    if (option === userAnswer && !isCorrect) {
                      className += ' incorrect-answer';
                    }
                    return <div key={optionIndex} className={className}>{option}</div>;
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <button onClick={onClose} className="action-btn close-btn">Close</button>
      </div>
    </div>
  );
}

export default QuizAttemptDetails;
