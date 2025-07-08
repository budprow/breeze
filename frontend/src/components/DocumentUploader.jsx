import React, { useState } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { storage, db, auth } from '../firebase';
import { v4 as uuidv4 } from 'uuid';
import './DocumentUploader.css';

function DocumentUploader({ restaurantId }) { // Receive restaurantId as a prop
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e) => {
      const selectedFile = e.target.files[0];
      if (selectedFile) {
        setFile(selectedFile);
        setError('');
      }
  };

  const handleUpload = () => {
    console.log("--- Starting Upload Process ---");
    
    // Get all the variables we need to check
    const user = auth.currentUser;
    const currentFile = file;
    const currentRestaurantId = restaurantId;

    // Log the status of each variable
    console.log("Checking prerequisites...");
    console.log("1. Does a file exist?", !!currentFile);
    console.log("2. Does a restaurantId exist?", !!currentRestaurantId, "(Value: ", currentRestaurantId, ")");
    console.log("3. Is a user logged in?", !!user);

    // If a user exists, log their ID
    if (user) {
      console.log("   - User ID is:", user.uid);
    }
    
    // Original check to stop the function if something is missing
    if (!currentFile || !currentRestaurantId || !user) {
      console.error("Upload stopped because a prerequisite is missing.");
      setError("Cannot upload. A required value is missing.");
      return;
    }

    // --- Original Upload Logic (no changes needed below) ---
    setIsUploading(true);
    const storagePath = `documents/${restaurantId}/${uuidv4()}-${file.name}`;
    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed', 
      (snapshot) => { setProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100); },
      (error) => {
        console.error("Upload error:", error);
        setError('Upload failed.');
        setIsUploading(false);
      },
      () => {
        getDownloadURL(uploadTask.snapshot.ref).then(async (downloadURL) => {
          const docData = {
            name: file.name,
            url: downloadURL,
            storagePath: storagePath,
            createdAt: serverTimestamp(),
            owner: auth.currentUser.uid,
          };
          await addDoc(collection(db, "restaurants", restaurantId, "documents"), docData);
          
          setIsUploading(false);
          setFile(null);
          setProgress(0);
        });
      }
    );
  };

  return (
    <div className="uploader-card">
        <h1 style={{color: 'red'}}>IS THIS COMPONENT VISIBLE?</h1>
        <input type="file" id="documentUpload" onChange={handleFileChange} style={{display: 'none'}} />
        <label htmlFor="documentUpload" className="upload-label">
            {file ? `Selected: ${file.name}` : 'Choose Document (PDF, IMG)'}
        </label>
        
        {isUploading ? (
            <div className="progress-bar-container">
            <div className="progress-bar" style={{width: `${progress}%`}}>
                {Math.round(progress)}%
            </div>
            </div>
        ) : (
            <button onClick={handleUpload} className="upload-button" disabled={!file}>
            Upload and Save
            </button>
        )}

        {error && <p className="error-text">{error}</p>}
    </div>
  );
}

export default DocumentUploader;