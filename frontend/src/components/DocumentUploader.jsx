import React, { useState, useEffect } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { storage, db, auth } from '../firebase';
import { v4 as uuidv4 } from 'uuid';
import './DocumentUploader.css';

function DocumentUploader({ onFileSelect }) {
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [user, setUser] = useState(auth.currentUser);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
    });
    return unsubscribe;
  }, []);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (user && user.isAnonymous) {
        onFileSelect(selectedFile);
      } else {
        setFile(selectedFile);
      }
      setError('');
    }
  };

  const handleUpload = () => {
    if (!file || !user || user.isAnonymous) {
      setError("You must be logged in to upload and save files.");
      return;
    }

    setIsUploading(true);
    const storagePath = `documents/${user.uid}/${uuidv4()}-${file.name}`;
    const storageRef = ref(storage, storagePath);
    
    const metadata = { customMetadata: { 'ownerUid': user.uid } };
    const uploadTask = uploadBytesResumable(storageRef, file, metadata);

    uploadTask.on('state_changed', 
      (snapshot) => { setProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100); },
      (error) => {
        console.error("Upload error:", error);
        setError('Upload failed. Check console for details.');
        setIsUploading(false);
      },
      () => {
        getDownloadURL(uploadTask.snapshot.ref).then(async (downloadURL) => {
          await addDoc(collection(db, "documents"), {
            name: file.name,
            url: downloadURL,
            storagePath: storagePath,
            createdAt: serverTimestamp(),
            ownerId: user.uid,
          });
          
          setIsUploading(false);
          setFile(null);
          setProgress(0);
        });
      }
    );
  };

  return (
    <div className="uploader-card">
      <input type="file" id="documentUpload" onChange={handleFileChange} style={{display: 'none'}} />
      <label htmlFor="documentUpload" className="upload-label">
        {file ? `Selected: ${file.name}` : 'Choose Document (PDF, IMG)'}
      </label>
      
      {user && !user.isAnonymous && (
        isUploading ? (
          <div className="progress-bar-container">
            <div className="progress-bar" style={{width: `${progress}%`}}>
              {Math.round(progress)}%
            </div>
          </div>
        ) : (
          <button onClick={handleUpload} className="upload-button" disabled={!file}>
            Upload and Save
          </button>
        )
      )}

      {error && <p className="error-text">{error}</p>}
    </div>
  );
}

export default DocumentUploader;