import React, { useEffect, useState, useCallback, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { useDocumentData } from 'react-firebase-hooks/firestore';
import { doc, collection, getDocs } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';
import { db, auth } from '../firebase';
import api from '../api';
import QuizFlow from '../QuizFlow';
import PdfViewer from './PdfViewer';
import './ActiveReader.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

function ActiveReader() {
    const [documentId, setDocumentId] = useState(null);
    const [pdf, setPdf] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [currentPageText, setCurrentPageText] = useState('');
    const [mainQuizData, setMainQuizData] = useState(null);
    const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
    const [quizError, setQuizError] = useState('');
    const [microQuizData, setMicroQuizData] = useState(null);
    const [isGeneratingMicroQuiz, setIsGeneratingMicroQuiz] = useState(false);
    const [microQuizError, setMicroQuizError] = useState('');
    const [highlights, setHighlights] = useState([]);
    const [user, authLoading, authError] = useAuthState(auth);
    const [docValue, docLoading, docError] = useDocumentData(
        user && documentId ? doc(db, 'users', user.uid, 'documents', documentId) : null
    );

    useEffect(() => {
        const path = window.location.pathname;
        if (path.startsWith('/read/')) {
            const docIdFromUrl = path.split('/')[2];
            setDocumentId(docIdFromUrl);
        }
    }, []);

    useEffect(() => {
        if (user && documentId) {
            const fetchHighlights = async () => {
                const highlightsColRef = collection(db, 'users', user.uid, 'documents', documentId, 'highlights');
                const snapshot = await getDocs(highlightsColRef);
                const loadedHighlights = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setHighlights(loadedHighlights);
            };
            fetchHighlights();
        }
    }, [user, documentId]);
    
    useEffect(() => {
        if (docValue && !pdf) {
            const loadPdf = async () => {
              try {
                const storage = getStorage();
                const fileRef = ref(storage, docValue.filePath);
                const url = await getDownloadURL(fileRef);
                const loadingTask = pdfjsLib.getDocument(url);
                const loadedPdf = await loadingTask.promise;
                setPdf(loadedPdf);
                setTotalPages(loadedPdf.numPages);
              } catch (err) {
                console.error("Error loading PDF:", err);
              }
            };
            loadPdf();
        }
    }, [docValue, pdf]);
    
    const handlePageRendered = useCallback((text) => {
        setCurrentPageText(text);
        setMainQuizData(null);
        setQuizError('');
    }, []);

    const handleSaveHighlight = async (selectedText) => {
        if (!documentId || !user) return;
        try {
            const response = await api.post('/api/highlights', {
                documentId,
                pageNumber: currentPage,
                selectedText,
            });
            setHighlights(prev => [...prev, { ...response.data, page: currentPage }]);
        } catch (error) {
            console.error("Failed to save highlight:", error);
        }
    };
    
    const handleIconClick = useCallback(async (sentence) => {
        setIsGeneratingMicroQuiz(true);
        setMicroQuizData(null);
        setMicroQuizError('');
        try {
            const response = await api.post('/api/generate-quiz', { text: sentence });
            setMicroQuizData(response.data);
        } catch (err) {
            console.error("Error generating micro-quiz:", err);
            setMicroQuizError("Sorry, could not generate a quiz for this concept.");
        } finally {
            setIsGeneratingMicroQuiz(false);
        }
    }, []);

    const handleGenerateQuiz = async () => {
        setIsGeneratingQuiz(true);
        setMainQuizData(null);
        setQuizError('');
        try {
            const response = await api.post('/api/generate-quiz', { text: currentPageText });
            setMainQuizData(response.data);
        } catch (err) {
            console.error("Error generating main quiz:", err);
            setQuizError("Sorry, we couldn't generate a quiz for this page.");
        } finally {
            setIsGeneratingQuiz(false);
        }
    };
    
    const goToPrevPage = () => setCurrentPage(prev => Math.max(1, prev - 1));
    const goToNextPage = () => setCurrentPage(prev => Math.min(totalPages, prev + 1));

    const keySentencesForPage = useMemo(() => (
        docValue?.keyConcepts?.[currentPage.toString()] || []
    ), [docValue, currentPage]);

    const highlightsForPage = useMemo(() => (
        highlights.filter(h => h.page === currentPage)
    ), [highlights, currentPage]);

    if (authLoading || docLoading || (docValue && !pdf) && !docError) {
        return <div className="loading-screen"><h1>Loading Document...</h1></div>;
    }
    if (authError || docError || (!docValue && !docLoading)) {
        return <div className="loading-screen"><h1>Error: {authError?.message || docError?.message}</h1></div>;
    }
    if (!user) {
        return <div className="loading-screen"><h1>Please log in to view this document.</h1></div>;
    }

    return (
        <div className="w-full">
            <h1 className="text-2xl font-bold mb-4 text-center">Active Reader: {docValue?.name}</h1>
            <div className="active-reader-container">
                <div className="reader-column">
                    <PdfViewer 
                        pdf={pdf}
                        pageNumber={currentPage}
                        onPageRendered={handlePageRendered}
                        keySentences={keySentencesForPage}
                        onIconClick={handleIconClick}
                        onSaveHighlight={handleSaveHighlight}
                        highlights={highlightsForPage}
                    />
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
                    {isGeneratingQuiz && <div className="quiz-placeholder text-center"><h4>Generating Quiz...</h4></div>}
                    {quizError && <div className="quiz-placeholder text-center"><h4 style={{color: 'red'}}>Error</h4><p>{quizError}</p></div>}
                    {mainQuizData && <QuizFlow initialQuizData={mainQuizData} sourceText={currentPageText} onFlowComplete={() => setMainQuizData(null)} />}
                    {!isGeneratingQuiz && !quizError && !mainQuizData && (
                         <div className="quiz-placeholder text-center">
                            <h4>Quiz Area</h4>
                            <p>Click "Quiz Page {currentPage}" to test your knowledge.</p>
                        </div>
                    )}
                </div>
            </div>

            {(isGeneratingMicroQuiz || microQuizData || microQuizError) && (
                <div className="modal-backdrop" onClick={() => { setMicroQuizData(null); setMicroQuizError(''); }}>
                    <div className="quiz-container" onClick={(e) => e.stopPropagation()}>
                        {isGeneratingMicroQuiz && <h4>✨ Generating Micro-Quiz...</h4>}
                        {microQuizError && <p style={{color: 'red'}}>{microQuizError}</p>}
                        {microQuizData && (
                            <QuizFlow
                                initialQuizData={microQuizData}
                                onFlowComplete={() => setMicroQuizData(null)}
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default ActiveReader;