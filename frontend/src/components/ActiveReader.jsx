import React, { useEffect, useState, useCallback } from 'react';
import api from '../api';
import QuizFlow from '../QuizFlow';
import PdfViewer from './PdfViewer'; // Import the new PDF Viewer
import './ActiveReader.css';

function ActiveReader() {
    const [fileUrl, setFileUrl] = useState('');
    const [documentName, setDocumentName] = useState('');
    const [currentPageText, setCurrentPageText] = useState('');
    const [totalPages, setTotalPages] = useState(0);

    const [quizData, setQuizData] = useState(null);
    const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
    const [quizError, setQuizError] = useState('');
    
    // This now only runs once to get the URL and document name
    useEffect(() => {
        const path = window.location.pathname;
        if (path.startsWith('/read/')) {
            const encodedUrl = path.substring(6);
            const decodedUrl = decodeURIComponent(encodedUrl);
            setFileUrl(decodedUrl);

            const nameFromUrl = decodedUrl.split('%2F').pop().split('?')[0];
            setDocumentName(decodeURIComponent(nameFromUrl));
        }
    }, []);

    // Callback function to get the extracted text from the PdfViewer
    const handlePageChange = useCallback((text) => {
        setCurrentPageText(text);
        setQuizData(null); // Clear old quiz data when page changes
        setQuizError('');
    }, []);
    
    // Callback function to get the total number of pages
    const handleDocumentLoad = useCallback((numPages) => {
      setTotalPages(numPages);
    }, []);

    const handleGenerateQuiz = async () => {
        if (!currentPageText) {
            setQuizError("There is no text on this page to generate a quiz from.");
            return;
        }
        setIsGeneratingQuiz(true);
        setQuizData(null);
        setQuizError('');
        try {
            const response = await api.post('/generate-quiz', { text: currentPageText });
            setQuizData(response.data);
        } catch (err) {
            console.error("Error generating quiz:", err);
            setQuizError("Sorry, we couldn't generate a quiz for this page.");
        } finally {
            setIsGeneratingQuiz(false);
        }
    };

    if (!fileUrl) {
        return <div className="loading-screen"><h1>Loading...</h1></div>;
    }

    return (
        <div className="w-full">
            <h1 className="text-2xl font-bold mb-4 text-center">Active Reader: {documentName}</h1>
            <div className="active-reader-container">
                <div className="reader-column">
                    {/* Render the new PdfViewer component */}
                    <PdfViewer 
                        fileUrl={fileUrl} 
                        onPageChange={handlePageChange}
                        onDocumentLoad={handleDocumentLoad}
                    />
                     <button 
                        onClick={handleGenerateQuiz}
                        disabled={isGeneratingQuiz || !currentPageText}
                        className="generate-page-quiz-btn"
                    >
                        {isGeneratingQuiz ? 'Generating...' : 'Generate Quiz for This Page'}
                    </button>
                </div>

                <div className="quiz-column">
                    {isGeneratingQuiz && (
                        <div className="quiz-placeholder text-center">
                            <h4>Generating Quiz...</h4>
                        </div>
                    )}
                    {quizError && (
                         <div className="quiz-placeholder text-center">
                            <h4 style={{color: 'red'}}>Error</h4>
                            <p>{quizError}</p>
                        </div>
                    )}
                    {quizData && (
                        <QuizFlow 
                            initialQuizData={quizData} 
                            sourceText={currentPageText}
                            onFlowComplete={() => setQuizData(null)}
                        />
                    )}
                    {!isGeneratingQuiz && !quizError && !quizData && (
                         <div className="quiz-placeholder text-center">
                            <h4>Quiz Area</h4>
                            <p>Generate a quiz for Page {totalPages > 0 ? '1' : '...'} to begin.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ActiveReader;