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
    // Get the current user at the start of the function
    const user = auth.currentUser;

    // Add a check to ensure user is logged in
    if (!file || !restaurantId || !user) {
      console.error("Upload prerequisites not met: Missing file, restaurantId, or user.");
      setError("Cannot upload. Please try again.");
      return;
    }

    // --- THIS IS THE DEBUG LINE TO ADD ---
    // It will print the logged-in user's ID to your browser console.
    console.log('Current User ID making the request:', user.uid);

    setIsUploading(true);
    // MODIFIED: The storage path now includes the restaurantId
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
          // MODIFIED: We now save the document record under the correct restaurant
          const docData = {
            name: file.name,
            url: downloadURL,
            storagePath: storagePath,
            createdAt: serverTimestamp(),
            owner: auth.currentUser.uid, // This assumes the user object hasn't changed.
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