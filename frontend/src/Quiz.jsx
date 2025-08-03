import React, { useState, useEffect } from 'react';
import api from './api'; // Import api
import './Quiz.css';

function Quiz({
  quizData,
  onSaveAndExit,
  onRegenerate,
  onExitWithoutSaving,
  refinementText,
  setRefinementText,
  onQuizStart,
  isSharedQuizFlow // ** THE FIX: Receive the new prop **
}) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [userAnswers, setUserAnswers] = useState({});
  const [startTime, setStartTime] = useState(null);
  const currentQuestion = quizData[currentQuestionIndex];

  useEffect(() => {
    // Start timer for all quiz types
    setStartTime(Date.now());
  }, []);

  const handleAnswerSelect = (option) => {
    if (isAnswered) return;
    setSelectedAnswer(option);
  };

  const handleSubmitAnswer = () => {
    if (selectedAnswer === null) {
      alert("Please select an answer!");
      return;
    }
    setUserAnswers(prev => ({...prev, [currentQuestionIndex]: selectedAnswer}));
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

  // ** THE FIX: A new save handler specifically for shared quiz retakes **
  const handleSaveSharedQuizRetake = async (currentScore, currentAnswers) => {
    const endTime = Date.now();
    const durationInSeconds = Math.round((endTime - startTime) / 1000);

    try {
      await api.post('/save-shared-quiz-result', {
        quizId: isSharedQuizFlow.originalQuizId,
        score: currentScore,
        quizData: quizData,
        answers: currentAnswers,
        duration: durationInSeconds,
      });
      alert("Your results have been updated!");
      onExitWithoutSaving(); // This function now resets state and returns to dashboard
    } catch (err) {
      console.error("Error saving shared quiz retake:", err);
      alert(err.response?.data || "Could not save your quiz result.");
    }
  };

  if (showResults) {
    return (
      <div className="quiz-container results-screen">
        <h2>Quiz Complete!</h2>
        <p className="final-score">Your Score: {score} out of {quizData.length}</p>

        <div className="refinement-container">
          <label htmlFor="refinementInput">Refine your quiz with new instructions:</label>
          <textarea
            id="refinementInput"
            className="refinement-input"
            placeholder='e.g., "ignore prices", "focus on names and dates"'
            value={refinementText}
            onChange={(e) => setRefinementText(e.target.value)}
          />
          <button onClick={() => onRegenerate(score)} className="process-button regenerate-button">
            Generate Updated Quiz
          </button>
        </div>

        <div className="results-actions">
          {/* ** THE FIX: Conditionally call the correct save function ** */}
          <button 
            onClick={() => isSharedQuizFlow ? handleSaveSharedQuizRetake(score, userAnswers) : onSaveAndExit(score, userAnswers)} 
            className="action-button save-exit-button"
          >
            Save and Return to Dashboard
          </button>
          
          <button onClick={onExitWithoutSaving} className="action-button exit-only-button">
            Return to Dashboard (Don't Save)
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
            <button onClick={handleNextQuestion} className="next-button"> Next </button>
        ) : (
            <button onClick={handleSubmitAnswer} className="check-button" disabled={selectedAnswer === null}> Check </button>
        )}
      </div>
    </div>
  );
}

export default Quiz;