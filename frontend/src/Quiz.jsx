import React, { useState } from 'react';
import './Quiz.css';

function Quiz({ quizData, onBackToDashboard, onSaveQuiz, onRegenerateQuiz, initialRefinement }) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [refinementText, setRefinementText] = useState(initialRefinement || '');
  const currentQuestion = quizData[currentQuestionIndex];

  const handleAnswerSelect = (option) => {
    if (isAnswered) return;
    setSelectedAnswer(option);
  };

  const handleSubmitAnswer = () => {
    if (selectedAnswer === null) {
      alert("Please select an answer!");
      return;
    }

    if (selectedAnswer === currentQuestion.correctAnswer) {
      setScore(prevScore => prevScore + 1);
    }
    setIsAnswered(true);
  };

  const handleNextQuestion = () => {
    const nextQuestionIndex = currentQuestionIndex + 1;
    if (nextQuestionIndex < quizData.length) {
      setCurrentQuestionIndex(nextQuestionIndex);
      setSelectedAnswer(null);
      setIsAnswered(false);
    } else {
      setShowResults(true);
    }
  };

  const handleRegenerate = () => {
    if (onRegenerateQuiz) {
        onRegenerateQuiz(refinementText);
    }
  };

  if (showResults) {
    return (
      <div className="quiz-container results-screen">
        <h2>Quiz Complete!</h2>
        <p className="final-score">Your Score: {score} out of {quizData.length}</p>

        <div className="results-actions">
            <button onClick={onSaveQuiz} className="action-button save">
                Save and Return to Dashboard
            </button>
            <button onClick={onBackToDashboard} className="action-button no-save">
                Return without Saving
            </button>
        </div>

        <div className="refinement-section">
          <label htmlFor="refinementInput">Want different questions? Give the AI new instructions:</label>
          <textarea
            id="refinementInput"
            className="refinement-input"
            placeholder='e.g., "focus on definitions", "make the questions harder"'
            value={refinementText}
            onChange={(e) => setRefinementText(e.target.value)}
          />
          <button onClick={handleRegenerate} className="action-button regenerate">
            Generate Updated Quiz
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-container">
      <div className="quiz-header">
        <p>Question {currentQuestionIndex + 1} of {quizData.length}</p>
      </div>

      <div className="question-text">
        <p>{currentQuestion.question}</p>
      </div>

      <div className="options-container">
        {currentQuestion.options.map((option, index) => {
          let buttonClass = 'option-button';
          if (isAnswered) {
            if (option === currentQuestion.correctAnswer) {
              buttonClass += ' correct';
            } else if (option === selectedAnswer) {
              buttonClass += ' wrong';
            }
          } else if (option === selectedAnswer) {
            buttonClass += ' selected';
          }

          return (
            <button key={index} className={buttonClass} onClick={() => handleAnswerSelect(option)} disabled={isAnswered}>
              {option}
            </button>
          );
        })}
      </div>

      <div className="quiz-footer">
        {isAnswered ? (
            <button onClick={handleNextQuestion} className="next-button">
              Next
            </button>
        ) : (
            <button onClick={handleSubmitAnswer} className="check-button" disabled={selectedAnswer === null}>
              Check
            </button>
        )}
      </div>
    </div>
  );
}

export default Quiz;