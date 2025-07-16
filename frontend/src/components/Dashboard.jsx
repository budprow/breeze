import React, { useState } from 'react';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, query, doc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore'; // Import addDoc and serverTimestamp
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase'; // Removed auth as it is not used
import DocumentUploader from './DocumentUploader';
import Quiz from '../Quiz';
import axios from 'axios';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import PdfjsWorker from 'pdfjs-dist/build/pdf.worker?url';
import Tesseract from 'tesseract.js';
import InviteManager from './InviteManager';
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

function Dashboard({ user, userProfile }) {
  const restaurantId = userProfile?.restaurantId;
  const isGuest = user.isAnonymous;

  const [docsValue, docsLoading, docsError] = useCollection(
    restaurantId ? query(collection(db, 'restaurants', restaurantId, 'documents')) : null
  );

  // New hook to fetch saved quizzes
  const [quizzesValue, quizzesLoading, quizzesError] = useCollection(
    restaurantId ? query(collection(db, 'restaurants', restaurantId, 'quizzes')) : null
  );

  const [selectedDoc, setSelectedDoc] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [refinement, setRefinement] = useState('');
  const [quizData, setQuizData] = useState(null);
  const [extractedText, setExtractedText] = useState('');

  const handleDelete = async (documentToDelete) => {
    if (!restaurantId) return;
    if (!window.confirm(`Are you sure you want to delete "${documentToDelete.data().name}"?`)) return;
    try {
      const fileRef = ref(storage, documentToDelete.data().storagePath);
      await deleteObject(fileRef);
      const docRef = doc(db, 'restaurants', restaurantId, 'documents', documentToDelete.id);
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
  
  const extractTextAndSetState = async () => {
      if (!selectedDoc) return;
      setIsLoading(true);
      try {
        const docUrl = selectedDoc.data().url;
        const response = await axios.get(docUrl, { responseType: 'blob' });
        const fileBlob = response.data;
        const fileType = fileBlob.type;
        let text = '';
        if (fileType.startsWith('image/')) {
          text = await processImage(fileBlob);
        } else if (fileType === 'application/pdf') {
          text = await processPdf(fileBlob);
        } else {
          throw new Error("Unsupported file type.");
        }
        setExtractedText(text);
        return text;
      } catch (error) {
        console.error("Error extracting text:", error);
        alert("Sorry, there was an error processing the document.");
        return null;
      } finally {
        setIsLoading(false);
      }
  }

  const handleGenerateQuiz = async (refinementText = refinement) => {
    let textToProcess = extractedText;
    if (!textToProcess) {
        textToProcess = await extractTextAndSetState();
    }
    
    if (!textToProcess) {
        // If text extraction failed or is empty
        alert("Could not extract text from the document to generate a quiz.");
        return;
    }

    setIsLoading(true);
    setProgress(50); // Text is ready, now generating
    try {
      const apiUrl = "https://us-central1-breeze-9c703.cloudfunctions.net/api";
      const quizResponse = await axios.post(`${apiUrl}/generate-quiz`, {
        text: textToProcess,
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
  
  const handleRegenerateQuiz = async (newRefinement) => {
    setRefinement(newRefinement);
    setQuizData(null); // Go back to loading screen
    await handleGenerateQuiz(newRefinement);
  };

  const handleSaveQuiz = async () => {
    if (!restaurantId || !user || !quizData || !selectedDoc) {
        alert("Cannot save quiz. Missing required information.");
        return;
    }
    try {
        const quizzesCollection = collection(db, 'restaurants', restaurantId, 'quizzes');
        await addDoc(quizzesCollection, {
            name: `Quiz for ${selectedDoc.data().name}`,
            documentId: selectedDoc.id,
            questions: quizData,
            createdAt: serverTimestamp(),
            owner: user.uid,
        });
        alert('Quiz saved successfully!');
        handleBackToDashboard(); // Return to dashboard after saving
    } catch (error) {
        console.error("Error saving quiz:", error);
        alert("Failed to save the quiz.");
    }
  };

  const handleBackToDashboard = () => {
    setSelectedDoc(null);
    setQuizData(null);
    setRefinement('');
    setExtractedText('');
  };
  
  if (quizData) {
    return (
      <Quiz 
        quizData={quizData} 
        onBackToDashboard={handleBackToDashboard}
        onSaveQuiz={handleSaveQuiz}
        onRegenerateQuiz={handleRegenerateQuiz}
        initialRefinement={refinement}
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
            value={refinement}
            onChange={(e) => setRefinement(e.target.value)}
          />
        </div>
        {isLoading && (
            <div className="progress-bar-container">
                <div className="progress-bar" style={{width: `${progress}%`}}>{progress > 0 ? `${Math.round(progress)}%` : ''}</div>
            </div>
        )}
        <div className="document-actions">
            <button onClick={handleBackToDashboard} className="action-btn delete-btn">Back</button>
            <button onClick={() => handleGenerateQuiz(refinement)} className="action-btn generate-btn" disabled={isLoading}>
                {isLoading ? 'Processing...' : 'Generate Quiz'}
            </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="dashboard-container">
      <div className="dashboard-section">
        <h3>My Training Documents</h3>
        {isGuest ? (
          <p className="guest-message">Sign up for a full account to upload and save your own documents!</p>
        ) : userProfile?.role === 'administrator' ? (
          <DocumentUploader restaurantId={restaurantId} />
        ) : (
          <p>Your assigned training documents will appear here.</p>
        )}
        <div className="document-list">
          {docsError && <strong>Error: {JSON.stringify(docsError)}</strong>}
          {docsLoading && <span>Loading documents...</span>}
          {isGuest ? (
            <p className="no-documents">This is where your uploaded documents would appear. Sign up to save your work!</p>
          ) : docsValue && (
            <ul>
              {docsValue.docs.map((doc) => (
                <li key={doc.id} className="document-item">
                  <span>{doc.data().name}</span>
                  <div className="document-actions">
                      <button onClick={() => setSelectedDoc(doc)} className="action-btn generate-btn">
                          Generate Quiz
                      </button>
                      {userProfile?.role === 'administrator' && (
                          <button onClick={() => handleDelete(doc)} className="action-btn delete-btn">
                              Delete
                          </button>
                      )}
                  </div>
                </li>
              ))}
               {docsValue.docs.length === 0 && !docsLoading && (
                  <p className="no-documents">You haven't uploaded any documents yet.</p>
              )}
            </ul>
          )}
        </div>
      </div>

      {!isGuest && (
        <div className="dashboard-section">
          <h3>My Quizzes</h3>
          {quizzesError && <strong>Error: {JSON.stringify(quizzesError)}</strong>}
          {quizzesLoading && <span>Loading quizzes...</span>}
          {quizzesValue && (
            <ul className="document-list">
              {quizzesValue.docs.map((quiz) => (
                <li key={quiz.id} className="document-item">
                  <span>{quiz.data().name}</span>
                  {/* Placeholder for future actions */}
                  <div className="document-actions">
                    <button className="action-btn view-btn">Take Quiz</button>
                    <button className="action-btn delete-btn">Delete</button>
                  </div>
                </li>
              ))}
              {quizzesValue.docs.length === 0 && !quizzesLoading && (
                <p className="no-documents">You haven't saved any quizzes yet.</p>
              )}
            </ul>
          )}
        </div>
      )}

      {userProfile?.role === 'administrator' && (
        <div className="dashboard-section">
          <InviteManager restaurantId={restaurantId} />
        </div>
      )}
    </div>
  );
}

export default Dashboard;