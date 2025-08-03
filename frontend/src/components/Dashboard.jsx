import React, { useState } from 'react';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, query, doc, deleteDoc, where, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { auth, db, storage } from '../firebase';
import DocumentUploader from './DocumentUploader';
import Quiz from '../Quiz';
import api from '../api';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import PdfjsWorker from 'pdfjs-dist/build/pdf.worker?url';
import Tesseract from 'tesseract.js';
import QuizList from './QuizList';
import QuizResults from './QuizResults';
import QuizAttemptDetails from './QuizAttemptDetails';
import ShareQuizModal from './ShareQuizModal';
import './Dashboard.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = PdfjsWorker;

function preprocessCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      const contrast = 1.5; 
      let value = (avg - 128) * contrast + 128;
      if (value > 255) value = 255;
      if (value < 0) value = 0;
      data[i] = data[i+1] = data[i+2] = value;
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

function Dashboard({ user }) {
  const [docsValue, docsLoading, docsError] = useCollection(
    user ? query(collection(db, 'documents'), where('ownerId', '==', user.uid)) : null
  );

  const [selectedDoc, setSelectedDoc] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [refinementText, setRefinementText] = useState('');
  const [quizData, setQuizData] = useState(null);
  const [showResultsModal, setShowResultsModal] = useState(null);
  const [viewingDetailsFor, setViewingDetailsFor] = useState(null);
  const [quizToShare, setQuizToShare] = useState(null);
  const [isSharedQuizFlow, setIsSharedQuizFlow] = useState(null);

  const handleDelete = async (documentToDelete) => {
    if (!window.confirm(`Are you sure you want to delete "${documentToDelete.data().name}"?`)) return;
    try {
      const fileRef = ref(storage, documentToDelete.data().storagePath);
      await deleteObject(fileRef);
      const docRef = doc(db, 'documents', documentToDelete.id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting document:", error);
      alert("Failed to delete document.");
    }
  };

  const processImage = async (blob) => {
    const { data: { text } } = await Tesseract.recognize(blob, 'eng', {
        logger: (m) => {
            if (m.status === 'recognizing text') setProgress(Math.round(m.progress * 50));
        },
    });
    return text;
  };

  const processPdf = async (blob) => {
    const fileReader = new FileReader();
    fileReader.readAsArrayBuffer(blob);
    return new Promise((resolve, reject) => {
        fileReader.onload = async () => {
            try {
                const typedarray = new Uint8Array(fileReader.result);
                const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
                let fullText = '';
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    if (textContent.items.length > 0) {
                        fullText += textContent.items.map((item) => item.str).join(' ');
                    } else {
                        const viewport = page.getViewport({ scale: 2 });
                        const canvas = document.createElement('canvas');
                        canvas.height = viewport.height;
                        canvas.width = viewport.width;
                        const context = canvas.getContext('2d');
                        await page.render({ canvasContext: context, viewport }).promise;
                        const preprocessedCanvas = preprocessCanvas(canvas);
                        const { data: { text } } = await Tesseract.recognize(preprocessedCanvas, 'eng');
                        fullText += text;
                    }
                }
                resolve(fullText);
            } catch (error) {
                reject(error);
            }
        };
        fileReader.onerror = (error) => reject(error);
    });
  };

  const handleGenerateQuiz = async () => {
    if (!selectedDoc) return;
    setIsLoading(true);
    setProgress(0);
    setQuizData(null); 
    try {
      const docUrl = selectedDoc.data().url;
      const response = await api.get(docUrl, { responseType: 'blob' });
      const fileBlob = response.data;
      const fileType = fileBlob.type;
      let extractedText = '';

      if (fileType.startsWith('image/')) {
        extractedText = await processImage(fileBlob);
      } else if (fileType === 'application/pdf') {
        extractedText = await processPdf(fileBlob);
      } else {
        throw new Error("Unsupported file type for quiz generation.");
      }
      
      setProgress(50);
      
      const quizResponse = await api.post(`/generate-quiz`, {
        text: extractedText,
        refinementText: refinementText,
      });
      
      setQuizData(quizResponse.data.questions);
      setProgress(100);

    } catch (error) {
      console.error("Error generating quiz:", error);
      alert("Sorry, there was an error generating the quiz.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const resetToDashboard = () => {
    setSelectedDoc(null);
    setQuizData(null);
    setRefinementText('');
    setIsSharedQuizFlow(null);
  };

  const handleSaveAndExit = async (score, answers) => {
    if (!quizData || !selectedDoc) return;
    try {
      await api.post('/save-quiz', {
        quizData: quizData,
        score: score,
        documentName: selectedDoc.data().name,
        documentId: selectedDoc.id,
        answers: answers
      });
      alert("Quiz saved!");
    } catch (error) {
      console.error("Error saving quiz:", error);
      alert("Could not save the quiz. Please try again.");
    }
    resetToDashboard();
  };
  
  const handleRegenerate = () => {
    handleGenerateQuiz();
  };

  const handleExitWithoutSaving = () => {
    resetToDashboard();
  };
    
  const handleRetakeQuiz = async (quizToRetake) => {
    const quizDataFromList = quizToRetake.data();

    if (quizDataFromList.originalQuizId) {
      // ** THE FIX: Check the attempt limit before starting the retake **
      const resultsRef = collection(db, 'quizzes', quizDataFromList.originalQuizId, 'results');
      const q = query(resultsRef, where('takerId', '==', user.uid));
      const querySnapshot = await getDocs(q);

      const originalQuizRef = doc(db, 'quizzes', quizDataFromList.originalQuizId);
      const originalQuizSnap = await getDoc(originalQuizRef);
      const limit = originalQuizSnap.exists() ? originalQuizSnap.data().attemptLimit || 10 : 10;

      if (querySnapshot.size >= limit) {
        alert("You have reached the maximum number of attempts for this quiz.");
        return; // Stop the function here
      }
      setIsSharedQuizFlow({ originalQuizId: quizDataFromList.originalQuizId });
    } else {
      setIsSharedQuizFlow(null);
    }
    
    const mockDocument = {
      id: quizDataFromList.documentId,
      data: () => ({ name: quizDataFromList.documentName }),
    };
    setSelectedDoc(mockDocument);
    setQuizData(quizDataFromList.quizData);
  };

  const handleRefineQuiz = async (documentId) => {
    const docRef = doc(db, 'documents', documentId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      setSelectedDoc(docSnap);
      setIsSharedQuizFlow(null);
    } else {
      console.error("Original document not found for this quiz.");
      alert("Could not find the original document to refine this quiz.");
    }
  };

  const handleUpdateQuizName = async (quizId, newName) => {
    const quizRef = doc(db, 'quizzes', quizId);
    try {
      await updateDoc(quizRef, { documentName: newName });
    } catch (error) {
      console.error("Error updating quiz name:", error);
      alert("Could not update quiz name. Please try again.");
    }
  };

  const handleShareQuiz = (quiz) => { setQuizToShare(quiz); };
  const handleSetAttemptLimit = async (quizId, limit) => {
    const quizRef = doc(db, 'quizzes', quizId);
    await updateDoc(quizRef, { attemptLimit: limit });
  };
  const handleViewDetails = (result) => { setViewingDetailsFor(result); };
  const handleShowResults = (quiz) => { setShowResultsModal(quiz); };

  if (quizData) {
    return (
      <Quiz
        quizData={quizData}
        isSharedQuizFlow={isSharedQuizFlow}
        onSaveAndExit={handleSaveAndExit}
        onRegenerate={handleRegenerate}
        onExitWithoutSaving={handleExitWithoutSaving}
        refinementText={refinementText}
        setRefinementText={setRefinementText}
      />
    );
  }
  
  if (selectedDoc) {
    return (
      <div className="dashboard-container">
        <h3>Generate Quiz for: {selectedDoc.data().name}</h3>
        <div className="refinement-container">
          <label htmlFor="refinementInput">Optional: Add instructions for the quiz</label>
          <textarea
            id="refinementInput"
            className="refinement-input"
            placeholder='e.g., "focus on ingredients", "ignore prices"'
            value={refinementText}
            onChange={(e) => setRefinementText(e.target.value)}
          />
        </div>
        {isLoading && (
            <div className="progress-bar-container">
                <div className="progress-bar" style={{width: `${progress}%`}}>{Math.round(progress)}%</div>
            </div>
        )}
        <div className="document-actions">
            <button onClick={resetToDashboard} className="action-btn delete-btn">Back</button>
            <button onClick={handleGenerateQuiz} className="action-btn generate-btn" disabled={isLoading}>
                {isLoading ? 'Generating...' : 'Generate Quiz'}
            </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="dashboard-container">
      {quizToShare && ( <ShareQuizModal quiz={quizToShare} onShare={handleSetAttemptLimit} onClose={() => setQuizToShare(null)} /> )}
      {showResultsModal && !viewingDetailsFor && ( <QuizResults quiz={showResultsModal} onViewDetails={handleViewDetails} onClose={() => setShowResultsModal(null)} /> )}
      {showResultsModal && viewingDetailsFor && (
        <QuizAttemptDetails
          result={viewingDetailsFor}
          quizData={showResultsModal.data()}
          onClose={() => { setViewingDetailsFor(null); setShowResultsModal(null); }}
        />
      )}

      <div className="dashboard-section">
        <h3>My Training Documents</h3>
        {user.isAnonymous ? ( <p className="guest-message">Sign up for a full account to upload and save your own documents!</p> ) : ( <DocumentUploader /> )}
        <div className="document-list">
          {docsError && <strong>Error: {JSON.stringify(docsError)}</strong>}
          {docsLoading && <span>Loading documents...</span>}
          {user.isAnonymous ? ( <p className="no-documents">This is where your uploaded documents would appear. Sign up to save your work!</p> ) : docsValue && (
            <ul>
              {docsValue.docs.map((doc) => (
                <li key={doc.id} className="document-item">
                  <span>{doc.data().name}</span>
                  <div className="document-actions">
                      <button onClick={() => { setSelectedDoc(doc); setIsSharedQuizFlow(null); }} className="action-btn generate-btn"> Generate Quiz </button>
                      <button onClick={() => handleDelete(doc)} className="action-btn delete-btn"> Delete </button>
                  </div>
                </li>
              ))}
               {docsValue.docs.length === 0 && !docsLoading && ( <p className="no-documents">You haven't uploaded any documents yet.</p> )}
            </ul>
          )}
        </div>
      </div>

      <div className="dashboard-section">
        <QuizList
          onRetake={handleRetakeQuiz}
          onRefine={handleRefineQuiz}
          onShowResults={handleShowResults}
          onShare={handleShareQuiz}
          onUpdateName={handleUpdateQuizName}
        />
      </div>
    </div>
  );
}

export default Dashboard;