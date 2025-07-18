import React, { useState } from 'react';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, query, doc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase';
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

function Dashboard({ user, userProfile, profileLoading }) {
  const restaurantId = userProfile?.restaurantId;
  const isGuest = user.isAnonymous;

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [extractedText, setExtractedText] = useState('');
  const [quizTitle, setQuizTitle] = useState('');

  const [docsValue, docsLoading, docsError] = useCollection(
    restaurantId && !isGuest ? query(collection(db, 'restaurants', restaurantId, 'documents')) : null
  );
  const [quizzesValue, quizzesLoading, quizzesError] = useCollection(
    restaurantId && !isGuest ? query(collection(db, 'restaurants', restaurantId, 'quizzes')) : null
  );
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [refinement, setRefinement] = useState('');
  const [quizData, setQuizData] = useState(null);
  const [isRetake, setIsRetake] = useState(false);

  const handleDeleteDoc = async (documentToDelete) => {
    if (!restaurantId || isGuest) return;
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

  const handleDeleteQuiz = async (quizToDeleteId, quizToDeleteName) => {
      if (!restaurantId || isGuest) return;
      if (!window.confirm(`Are you sure you want to delete the quiz "${quizToDeleteName}"?`)) return;
      try {
          const docRef = doc(db, 'restaurants', restaurantId, 'quizzes', quizToDeleteId);
          await deleteDoc(docRef);
      } catch (error) {
          console.error("Error deleting quiz:", error);
          alert("Failed to delete quiz.");
      }
  }

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files);
    if (files.length > 0) {
        setSelectedFiles(files);
        setExtractedText('');
        setProgress(0);
        setQuizData(null);
        setRefinement('');
        setSelectedDoc(null);
        setQuizTitle('');
    }
  };

    const processImage = async (file) => {
        const { data: { text } } = await Tesseract.recognize(file, 'eng');
        return text;
    };
    const processPdf = async (file) => {
        const fileReader = new FileReader();
        fileReader.readAsArrayBuffer(file);
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
    const extractTextFromFiles = async () => {
        if (selectedFiles.length === 0) return null;
        let combinedText = '';
        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            let text = '';
            setProgress(Math.round(((i + 1) / selectedFiles.length) * 50));
            if (file.type.startsWith('image/')) {
                text = await processImage(file);
            } else if (file.type === 'application/pdf') {
                text = await processPdf(file);
            }
            combinedText += text + '\n\n';
        }
        return combinedText;
    };
    const extractTextFromDoc = async () => {
        if (!selectedDoc) return null;
        const docUrl = selectedDoc.data().url;
        const response = await axios.get(docUrl, { responseType: 'blob' });
        const fileBlob = response.data;
        const fileType = fileBlob.type;
        if (fileType.startsWith('image/')) {
            return await processImage(fileBlob);
        } else if (fileType === 'application/pdf') {
            return await processPdf(fileBlob);
        }
        throw new Error("Unsupported file type.");
    }

  const handleGenerateQuiz = async (refinementText = refinement) => {
    setIsLoading(true);
    setIsRetake(false);
    let textToProcess = extractedText;

    try {
        if (!textToProcess) {
            if(selectedFiles.length > 0) {
                textToProcess = await extractTextFromFiles();
            } else if (selectedDoc) {
                textToProcess = await extractTextFromDoc();
            }
        }

        if (!textToProcess) {
            alert("Could not find text to process. Please upload or select a document first.");
            setIsLoading(false);
            return;
        }

        setExtractedText(textToProcess);
        setProgress(50);
        const apiUrl = "https://us-central1-breeze-9c703.cloudfunctions.net/api";
        const quizResponse = await axios.post(`${apiUrl}/generate-quiz`, {
            text: textToProcess,
            refinementText: refinementText,
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

  const handleRegenerateQuiz = async (newRefinement) => {
    setRefinement(newRefinement);
    setQuizData(null);
    await handleGenerateQuiz(newRefinement);
  };

  const handleSaveQuiz = async () => {
    if (isGuest) {
        alert("Sign up for a free account to save your quizzes!");
        return;
    }

    if (!restaurantId) {
        alert("Could not find your organization ID. Please try again.");
        return;
    }
    
    const docName = quizTitle || (selectedDoc ? selectedDoc.data().name : selectedFiles.length > 0 ? selectedFiles[0].name : "Untitled Quiz");

    if (!quizData) {
        alert("Cannot save quiz. No quiz data available.");
        return;
    }

    try {
        const quizzesCollection = collection(db, 'restaurants', restaurantId, 'quizzes');
        await addDoc(quizzesCollection, {
            name: docName,
            documentId: selectedDoc ? selectedDoc.id : null,
            questions: quizData,
            createdAt: serverTimestamp(),
            owner: user.uid,
        });
        alert('Quiz saved successfully!');
        handleBackToDashboard();
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
    setSelectedFiles([]);
    setProgress(0);
    setIsRetake(false);
    setQuizTitle('');
  };

  const handleTakeQuiz = (quiz) => {
    setQuizData(quiz.questions);
    setIsRetake(true);
  }

  if (quizData) {
    return (
      <Quiz
        quizData={quizData}
        onBackToDashboard={handleBackToDashboard}
        onSaveQuiz={handleSaveQuiz}
        onRegenerateQuiz={handleRegenerateQuiz}
        initialRefinement={refinement}
        isGuest={isGuest}
        isRetake={isRetake}
      />
    );
  }

  const renderUploader = () => {
      const fileInputLabel = selectedFiles.length > 0
          ? `${selectedFiles.length} file(s) selected. Change?`
          : 'Choose Document(s) or Take Photo(s)';

      const showGenerateButton = selectedFiles.length > 0 || selectedDoc;
      const isUiDisabled = isLoading || (!isGuest && profileLoading);

      let generateButtonText = 'Generate Quiz';
      if(isLoading) {
          generateButtonText = progress < 50 ? 'Reading...' : 'Generating...';
      } else if (profileLoading && !isGuest) {
          generateButtonText = 'Loading Profile...';
      } else if (selectedDoc) {
          generateButtonText = 'Generate Quiz from Saved Doc';
      } else if (selectedFiles.length > 0) {
          generateButtonText = 'Generate Quiz from Upload';
      }

      return (
        <>
            <div className="upload-step">
                <h3>{isGuest ? 'Step 1: Upload Your Materials' : 'Generate a New Quiz'}</h3>
                <input type="file" id="fileInput" multiple accept="image/*,application/pdf" onChange={handleFileChange} style={{display: 'none'}} />
                <label htmlFor="fileInput" className="uploader-label">{fileInputLabel}</label>
                
                {selectedFiles.length > 0 && (
                    <div className="file-list-container">
                        <input
                            type="text"
                            className="group-name-input"
                            placeholder="Name this study set (e.g., 'Chapter 5 Notes')"
                            value={quizTitle}
                            onChange={(e) => setQuizTitle(e.target.value)}
                        />
                        <ul className="file-list-preview">
                            {selectedFiles.map((file, index) => <li key={index}>{file.name}</li>)}
                        </ul>
                    </div>
                )}
            </div>

            {(showGenerateButton) && (
                 <div className="upload-step">
                    <h3>{isGuest ? 'Step 2: Generate Quiz' : 'Add Instructions (Optional)'}</h3>
                    <div className="refinement-container">
                        <textarea
                            id="refinementInput"
                            className="refinement-input"
                            placeholder='e.g., "focus on dates and names", "ignore the summary section"'
                            value={refinement}
                            onChange={(e) => setRefinement(e.target.value)}
                        />
                    </div>
                    {isLoading && (
                        <div className="progress-bar-container">
                            <div className="progress-bar" style={{width: `${progress}%`}}>{progress > 0 ? `${Math.round(progress)}%` : ''}</div>
                        </div>
                    )}
                    <button onClick={() => handleGenerateQuiz(refinement)} className="process-button" disabled={isUiDisabled}>
                        {generateButtonText}
                    </button>
                </div>
            )}
        </>
      )
  }

  return (
    <div className="dashboard-container">
      {renderUploader()}

      {!isGuest && (
        <>
          <div className="dashboard-section">
            <h3>My Training Documents</h3>
            {userProfile?.role === 'administrator' && <DocumentUploader restaurantId={restaurantId} />}
            <div className="document-list">
              {docsError && <strong>Error: {JSON.stringify(docsError)}</strong>}
              {(docsLoading || profileLoading) && <span>Loading documents...</span>}
              {docsValue && (
                <ul>
                  {docsValue.docs.map((doc) => (
                    <li key={doc.id} className="document-item">
                      <span>{doc.data().name}</span>
                      <div className="document-actions">
                          <button onClick={() => { setSelectedFiles([]); setSelectedDoc(doc); }} className="action-btn generate-btn">
                              Generate Quiz
                          </button>
                          {userProfile?.role === 'administrator' && (
                              <button onClick={() => handleDeleteDoc(doc)} className="action-btn delete-btn">
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

          <div className="dashboard-section">
            <h3>My Quizzes</h3>
            {quizzesError && <strong>Error: {JSON.stringify(quizzesError)}</strong>}
            {(quizzesLoading || profileLoading) && <span>Loading quizzes...</span>}
            {quizzesValue && (
              <ul className="document-list">
                {quizzesValue.docs.map((quiz) => (
                  <li key={quiz.id} className="document-item">
                    <span>{quiz.data().name}</span>
                    <div className="document-actions">
                      <button onClick={() => handleTakeQuiz(quiz.data())} className="action-btn view-btn">Take Quiz</button>
                      <button onClick={() => handleDeleteQuiz(quiz.id, quiz.data().name)} className="action-btn delete-btn">Delete</button>
                    </div>
                  </li>
                ))}
                {quizzesValue.docs.length === 0 && !quizzesLoading && (
                  <p className="no-documents">You haven't saved any quizzes yet.</p>
                )}
              </ul>
            )}
          </div>

          {userProfile?.role === 'administrator' && (
            <div className="dashboard-section">
              <InviteManager restaurantId={restaurantId} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Dashboard;