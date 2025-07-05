import React, { useState } from 'react';
import './Quiz.css';

// The Quiz component receives the quiz data and a function to handle restarting
function Quiz({ quizData, onGenerateNew }) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const currentQuestion = quizData[currentQuestionIndex];

  // Function to run when a user clicks an option
  const handleAnswerSelect = (option) => {
    if (isAnswered) return; // Don't allow changing answer after submission
    setSelectedAnswer(option);
  };

  // Function to run when the "Check" button is clicked
  const handleSubmitAnswer = () => {
    if (selectedAnswer === null) {
      alert("Please select an answer!");
      return;
    }

    // *** FIX #1: Use 'correctAnswer' instead of 'answer' ***
    if (selectedAnswer === currentQuestion.correctAnswer) {
      setScore(prevScore => prevScore + 1);
    }
    setIsAnswered(true);
  };

  // Function to move to the next question or show results
  const handleNextQuestion = () => {
    const nextQuestionIndex = currentQuestionIndex + 1;
    if (nextQuestionIndex < quizData.length) {
      setCurrentQuestionIndex(nextQuestionIndex);
      // Reset for the next question
      setSelectedAnswer(null);
      setIsAnswered(false);
    } else {
      // End of the quiz
      setShowResults(true);
    }
  };

  // If showResults is true, display the final score screen
  if (showResults) {
    return (
      <div className="quiz-container results-screen">
        <h2>Quiz Complete!</h2>
        <p className="final-score">Your Score: {score} out of {quizData.length}</p>
        <button onClick={onGenerateNew} className="restart-button">Generate New Quiz</button>
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
          // Determine the CSS class for the button based on its state
          let buttonClass = 'option-button';
          if (isAnswered) {
            // *** FIX #2: Use 'correctAnswer' instead of 'answer' ***
            if (option === currentQuestion.correctAnswer) {
              buttonClass += ' correct'; // Correct answer is always green
            } else if (option === selectedAnswer) {
              buttonClass += ' wrong'; // Selected wrong answer is red
            }
          } else if (option === selectedAnswer) {
            buttonClass += ' selected'; // Selected but not yet submitted
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