import React, { useState } from 'react';
import './Quiz.css';

function Quiz({ quizData, onGenerateNew }) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [showResults, setShowResults] = useState(false);
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

  if (showResults) {
    return (
      <div className="quiz-container results-screen">
        <h2>Quiz Complete!</h2>
        <p className="final-score">Your Score: {score} out of {quizData.length}</p>
        <button onClick={onGenerateNew} className="restart-button">Try with New Document/Instructions</button>
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