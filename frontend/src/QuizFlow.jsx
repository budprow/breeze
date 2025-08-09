import React, { useState } from 'react';
import Quiz from './Quiz.jsx'; // Corrected Path
import api from './api.js';   // Corrected Path
import './Quiz.css'; // Corrected Path

function QuizFlow({ initialQuizData, sourceText, onFlowComplete, isGuest }) {
    const [quizData, setQuizData] = useState(initialQuizData);
    const [showResults, setShowResults] = useState(false);
    const [refinement, setRefinement] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const handleQuizComplete = () => {
        setShowResults(true);
    };

    const handleSaveQuiz = async () => {
        if (isGuest) {
            alert("Please create an account to save your quizzes!");
            return;
        }
        try {
            await api.post('/save-quiz', { quizData });
            alert("Quiz saved successfully!");
            onFlowComplete(); // Go back to dashboard
        } catch (error) {
            console.error("Error saving quiz:", error);
            alert("Could not save the quiz.");
        }
    };

    const handleRegenerate = async () => {
        setIsGenerating(true);
        try {
            const response = await api.post('/generate-quiz', {
                text: sourceText,
                refinementText: refinement,
            });
            // Reset the flow with the new quiz data
            setQuizData(response.data);
            setShowResults(false);
        } catch (error) {
            console.error("Error regenerating quiz:", error);
            alert("Could not generate an updated quiz.");
        } finally {
            setIsGenerating(false);
        }
    };

    if (!showResults) {
        // Pass the questions array to the Quiz component
        return <Quiz quizData={quizData.questions} onQuizComplete={handleQuizComplete} />;
    }

    // This is the "Quiz Complete!" screen
    return (
        <div className="uploader-container">
            <div className="results-card">
                <h2>Quiz Complete!</h2>
                <p>What would you like to do next?</p>
                
                <div className="results-actions">
                    <button onClick={onFlowComplete} className="action-btn delete-btn">
                        Back to Dashboard (Don't Save)
                    </button>
                    {!isGuest && (
                         <button onClick={handleSaveQuiz} className="action-btn generate-btn">
                            Save this Quiz
                        </button>
                    )}
                </div>

                <div className="separator">or</div>

                <div className="upload-step">
                    <h3>Refine and Regenerate</h3>
                     <div className="refinement-container">
                        <label htmlFor="refinementInput">Give the AI new instructions to improve the quiz:</label>
                        <textarea
                            id="refinementInput"
                            className="refinement-input"
                            placeholder='e.g., "make the questions harder", "focus on the first paragraph"'
                            value={refinement}
                            onChange={(e) => setRefinement(e.target.value)}
                        />
                    </div>
                    <button onClick={handleRegenerate} className="process-button" disabled={isGenerating}>
                        {isGenerating ? 'Generating...' : 'Generate Updated Quiz'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default QuizFlow;