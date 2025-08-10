import React, { useEffect, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import api from '../api';
import QuizFlow from '../QuizFlow';
import PdfViewer from './PdfViewer';
import './ActiveReader.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

function ActiveReader() {
    const [fileUrl, setFileUrl] = useState('');
    const [documentName, setDocumentName] = useState('');
    const [pdf, setPdf] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [currentPageText, setCurrentPageText] = useState('');
    const [quizData, setQuizData] = useState(null);
    const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
    const [quizError, setQuizError] = useState('');

    // Effect to get the file URL from the browser's address bar
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
    
    // Effect to load the PDF document once we have the URL
    useEffect(() => {
        const loadPdf = async () => {
          try {
            const loadingTask = pdfjsLib.getDocument(fileUrl);
            const loadedPdf = await loadingTask.promise;
            setPdf(loadedPdf);
            setTotalPages(loadedPdf.numPages);
          } catch (err) {
            console.error("Error loading PDF:", err);
          }
        };
        if (fileUrl) {
          loadPdf();
        }
    }, [fileUrl]);
    
    // Callback to get the text from the currently rendered page
    const handlePageRendered = useCallback((text) => {
        setCurrentPageText(text);
        setQuizData(null);
        setQuizError('');
    }, []);
    
    const handleGenerateQuiz = async () => {
        setIsGeneratingQuiz(true);
        // ... (rest of the function is the same)
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
    
    const goToPrevPage = () => setCurrentPage(prev => Math.max(1, prev - 1));
    const goToNextPage = () => setCurrentPage(prev => Math.min(totalPages, prev + 1));

    if (!pdf) {
        return <div className="loading-screen"><h1>Loading Document...</h1></div>;
    }

    return (
        <div className="w-full">
            <h1 className="text-2xl font-bold mb-4 text-center">Active Reader: {documentName}</h1>
            <div className="active-reader-container">
                <div className="reader-column">
                    <PdfViewer 
                        pdf={pdf}
                        pageNumber={currentPage}
                        onPageRendered={handlePageRendered}
                    />
                    {/* --- THIS IS THE FIX --- */}
                    {/* All buttons are now grouped together in a single container */}
                    <div className="reader-controls">
                        <button onClick={goToPrevPage} disabled={currentPage <= 1} className="nav-button">
                          Previous
                        </button>
                        <button 
                            onClick={handleGenerateQuiz}
                            disabled={isGeneratingQuiz || !currentPageText}
                            className="generate-page-quiz-btn"
                        >
                            {isGeneratingQuiz ? 'Generating...' : `Quiz Page ${currentPage}`}
                        </button>
                        <button onClick={goToNextPage} disabled={currentPage >= totalPages} className="nav-button">
                          Next
                        </button>
                    </div>
                </div>

                <div className="quiz-column">
                    {/* ... (Quiz area JSX remains the same) ... */}
                    {isGeneratingQuiz && <div className="quiz-placeholder text-center"><h4>Generating Quiz...</h4></div>}
                    {quizError && <div className="quiz-placeholder text-center"><h4 style={{color: 'red'}}>Error</h4><p>{quizError}</p></div>}
                    {quizData && <QuizFlow initialQuizData={quizData} sourceText={currentPageText} onFlowComplete={() => setQuizData(null)} />}
                    {!isGeneratingQuiz && !quizError && !quizData && (
                         <div className="quiz-placeholder text-center">
                            <h4>Quiz Area</h4>
                            <p>Click "Quiz Page {currentPage}" to test your knowledge.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ActiveReader;