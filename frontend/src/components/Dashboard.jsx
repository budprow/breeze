import React, { useState, useEffect } from 'react';
import { getStorage, ref, uploadBytes, listAll, getDownloadURL } from 'firebase/storage';
import { getFirestore, collection, addDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { auth } from '../firebase';
import Quiz from './Quiz';
import '../Dashboard.css';

function Dashboard({ user }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [quizData, setQuizData] = useState(null);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [error, setError] = useState('');
  const [refinementText, setRefinementText] = useState('');
  const [loadingFile, setLoadingFile] = useState(null);

  const storage = getStorage();
  const db = getFirestore();

  useEffect(() => {
    const fetchFiles = async () => {
      if (user) {
        try {
          const userFilesRef = ref(storage, `uploads/${user.uid}`);
          const res = await listAll(userFilesRef);
          const fileData = await Promise.all(
            res.items.map(async (itemRef) => {
              const url = await getDownloadURL(itemRef);
              return { id: itemRef.fullPath, name: itemRef.name, url };
            })
          );
          setFiles(fileData);
        } catch (error) {
          console.error("Error fetching files:", error);
          setError("Failed to load your files.");
        } finally {
          setLoadingFiles(false);
        }
      }
    };
    fetchFiles();
  }, [user, storage]);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file first.");
      return;
    }
    setUploading(true);
    setError('');
    try {
      const storageRef = ref(storage, `uploads/${user.uid}/${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setFiles((prevFiles) => [...prevFiles, { id: storageRef.fullPath, name: file.name, url }]);
      setFile(null);
    } catch (error) {
      console.error("Error uploading file:", error);
      setError("File upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const extractTextFromFile = async (fileUrl) => {
    // This function can be expanded to handle different file types
    // For now, it assumes the backend can handle the URL directly
    // This might involve fetching the file and using a library like pdf.js on the server
    return fileUrl; 
  };
  
  const handleGenerateQuiz = async (fileUrl, fileName) => {
    setLoadingQuiz(true);
    setQuizData(null);
    setError('');
    setLoadingFile(fileName);
    try {
        const response = await fetch('/generate-quiz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileUrl, refinementText }),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || "Failed to generate quiz");
        }
        const data = await response.json();
        setQuizData(data);
    } catch (error) {
        console.error("Error generating quiz:", error);
        setError(error.message);
    } finally {
        setLoadingQuiz(false);
        setLoadingFile(null);
    }
  };

  const handleSaveQuiz = async () => {
    if (!quizData) {
      setError("No quiz to save.");
      return;
    }
    try {
      await addDoc(collection(db, `users/${user.uid}/quizzes`), {
        ...quizData,
        createdAt: serverTimestamp(),
        sourceFileName: loadingFile || 'Unknown'
      });
      alert("Quiz saved successfully!");
    } catch (error) {
      console.error("Error saving quiz:", error);
      setError("Failed to save the quiz.");
    }
  };

  return (
    <div className="dashboard-container">
      <div className="file-management-section">
        <h2>Your Files</h2>
        <div className="upload-section">
          <input type="file" onChange={handleFileChange} className="file-input" />
          <button onClick={handleUpload} disabled={uploading || !file}>
            {uploading ? 'Uploading...' : 'Upload File'}
          </button>
        </div>
        {loadingFiles ? (
          <p>Loading files...</p>
        ) : (
          <ul className="file-list">
            {files.map((file) => (
              <li key={file.id} className="flex justify-between items-center p-2 border-b">
                <span className="file-name">{file.name}</span>
                <div className="flex items-center gap-2">
                  <a 
                      href={`/read/${encodeURIComponent(file.url)}`}
                      className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-3 rounded text-sm no-underline"
                  >
                      Read
                  </a>
                  <button
                      onClick={() => handleGenerateQuiz(file.url, file.name)}
                      className="bg-green-500 hover:bg-green-600 text-white font-bold py-1 px-3 rounded text-sm"
                      disabled={loadingFile === file.name}
                  >
                      {loadingFile === file.name ? 'Generating...' : 'Generate Quiz'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="quiz-generation-section">
        <h2>Quiz Generation</h2>
        <textarea
          className="refinement-textarea"
          value={refinementText}
          onChange={(e) => setRefinementText(e.target.value)}
          placeholder="Enter any specific instructions for the quiz... (e.g., focus on dates, names, or specific topics)"
        />
        {loadingQuiz && <p>Generating your quiz, please wait...</p>}
        {error && <p className="error-message">{error}</p>}
        {quizData && (
          <div>
            <Quiz quizData={quizData} />
            <button onClick={handleSaveQuiz} className="save-quiz-button">Save Quiz</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;