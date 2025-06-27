import React, { useState } from 'react';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, query, doc, deleteDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { auth, db, storage } from '../firebase';
import DocumentUploader from './documentuploader';
import Quiz from '../Quiz'; // Correct path assumed to be ../Quiz
import axios from 'axios';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import PdfjsWorker from 'pdfjs-dist/build/pdf.worker?url';
import Tesseract from 'tesseract.js';
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
  // NEW: Get restaurantId and guest status from props
  const restaurantId = userProfile?.restaurantId;
  const isGuest = user.isAnonymous;

  // MODIFIED: This hook now fetches documents from the correct restaurant-specific collection
  const [docsValue, docsLoading, docsError] = useCollection(
    restaurantId ? query(collection(db, 'restaurants', restaurantId, 'documents')) : null
  );

  // All your existing state for managing the quiz flow
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [refinement, setRefinement] = useState('');
  const [quizData, setQuizData] = useState(null);

  const handleDelete = async (documentToDelete) => {
    if (!restaurantId) return; // Add check for safety
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
        });
    };

  const handleGenerateQuiz = async () => {
    if (!selectedDoc) return;
    setIsLoading(true);
    setProgress(0);
    try {
      const docUrl = selectedDoc.data().url;
      const response = await axios.get(docUrl, { responseType: 'blob' });
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
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const quizResponse = await axios.post(`${apiUrl}/generate-quiz`, {
        text: extractedText,
        refinementText: refinement,
      });
      setQuizData(quizResponse.data);
      setProgress(100);
    } catch (error) {
      console.error("Error generating quiz:", error);
      alert("Sorry, there was an error generating the quiz.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleBackToDashboard = () => {
    setSelectedDoc(null);
    setQuizData(null);
    setRefinement('');
  };

  // NEW: A check to handle the case where a registered user's profile is still loading
  if (!isGuest && !userProfile) {
    return <div className="dashboard-container">Loading your profile...</div>;
  }
  
  if (quizData) {
    return <Quiz quizData={quizData} onGenerateNew={handleBackToDashboard} />;
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
                <div className="progress-bar" style={{width: `${progress}%`}}>{Math.round(progress)}%</div>
            </div>
        )}
        <div className="document-actions">
            <button onClick={handleBackToDashboard} className="action-btn delete-btn">Back</button>
            <button onClick={handleGenerateQuiz} className="action-btn generate-btn" disabled={isLoading}>
                {isLoading ? 'Generating...' : 'Generate Quiz'}
            </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="dashboard-container">
      <h3>My Training Documents</h3>
      
      {/* NEW: Logic to conditionally show the uploader */}
      {isGuest ? (
        <p className="guest-message">Sign up for a full account to upload and save your own documents!</p>
      ) : userProfile?.role === 'manager' ? (
        <DocumentUploader restaurantId={restaurantId} />
      ) : (
        <p>Your assigned training documents will appear here.</p>
      )}

      <div className="document-list">
        {docsError && <strong>Error: {JSON.stringify(docsError)}</strong>}
        {docsLoading && <span>Loading documents...</span>}
        
        {/* NEW: Logic to conditionally show documents */}
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
                    {userProfile?.role === 'manager' && (
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
  );
}

export default Dashboard;