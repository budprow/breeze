import React, { useState, useEffect } from 'react';
import { useCollection, useCollectionData } from 'react-firebase-hooks/firestore';
import { collection, query, doc, deleteDoc, getDocs } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { auth, db, storage } from '../firebase';
import DocumentUploader from './DocumentUploader';
import Quiz from '../Quiz';
import api from '../api'; // <-- Using the new centralized api object
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

// The full Dashboard component
function Dashboard({ user, userProfile }) {
  const restaurantId = userProfile?.restaurantId;
  const [docsValue, docsLoading, docsError] = useCollection(
    restaurantId ? query(collection(db, 'restaurants', restaurantId, 'documents')) : null
  );

  const [view, setView] = useState('dashboard');
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [refinement, setRefinement] = useState('');
  const [quizData, setQuizData] = useState(null);
  const [scores, setScores] = useState([]);

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

  const handleGenerateQuiz = async () => {
    if (!selectedDoc || !user) return;
    setIsLoading(true);
    setProgress(0);
    try {
      const docUrl = selectedDoc.data().url;
      // axios doesn't need the api interceptor for public URLs
      const response = await axios.get(docUrl, { responseType: 'blob' });
      const fileBlob = response.data;
      let extractedText = '';

      if (fileBlob.type.startsWith('image/')) {
        extractedText = await processImage(fileBlob);
      } else if (fileBlob.type === 'application/pdf') {
        extractedText = await processPdf(fileBlob);
      } else {
        throw new Error("Unsupported file type for quiz generation.");
      }
      
      setProgress(50);
      
      // Use the centralized api object to call our backend
      const quizResponse = await api.post('/generate-quiz', {
        text: extractedText,
        refinementText: refinement,
      });

      setQuizData(quizResponse.data.questions);
      setProgress(100);

    } catch (error) {
      console.error("Error during quiz generation:", error);
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
      <div className="dashboard-section">
        <h3>My Training Documents</h3>
        {userProfile?.role === 'administrator' && (
          <DocumentUploader restaurantId={restaurantId} />
        )}
        <div className="document-list">
          {docsError && <strong>Error: {JSON.stringify(docsError)}</strong>}
          {docsLoading && <span>Loading documents...</span>}
          {docsValue && (
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

      {userProfile?.role === 'administrator' && (
        <div className="dashboard-section">
          <InviteManager restaurantId={restaurantId} />
        </div>
      )}
    </div>
  );
}

export default Dashboard;