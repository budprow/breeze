import React from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { db, storage, auth } from '../firebase';
import api from '../api';
import './DocumentUploader.css';

function DocumentUploader({ file, onFileChange, onUpload, uploading }) {

  const handleUploadAndSave = async () => {
    if (!file) {
      alert("Please select a file first.");
      return;
    }
    
    const user = auth.currentUser;
    if (!user) {
      alert("You must be logged in to upload files.");
      return;
    }

    onUpload(true); 

    try {
      // --- THIS IS THE FIX ---
      // Reverting to the simple, correct path format that works everywhere.
      const filePath = `documents/${user.uid}/${file.name}`;
      const storageRef = ref(storage, filePath);
      await uploadBytes(storageRef, file);
      console.log("File uploaded to Storage successfully!");

      const docRef = await addDoc(collection(db, 'users', user.uid, 'documents'), {
        name: file.name,
        filePath: filePath, // Save the simple path
        createdAt: serverTimestamp(),
        ownerId: user.uid
      });
      console.log("File record saved to Firestore with ID:", docRef.id);

      alert("File uploaded successfully! The AI is now analyzing it for key concepts.");
      onFileChange({ target: { files: [null] } }); 

      api.post('/api/documents/process', {
        documentId: docRef.id,
        filePath: filePath // Send the simple path
      }).then(() => {
        console.log("Backend processing triggered successfully!");
      }).catch(error => {
        console.error("An error occurred during the background AI processing:", error);
      });

    } catch (error) {
        console.error("An error occurred during the initial upload:", error);
        alert("Initial upload failed. Please check the console for details.");
    } finally {
        onUpload(false);
    }
  };


  return (
    <div className="upload-step">
      <h3>Upload a Document</h3>
      <label className="uploader-label">
        {file ? `Selected: ${file.name}` : 'Choose Document (PDF)'}
        <input type="file" onChange={onFileChange} style={{ display: 'none' }} accept=".pdf" />
      </label>
      
      <button onClick={handleUploadAndSave} disabled={uploading || !file} className="action-btn generate-btn">
        {uploading ? 'Uploading & Processing...' : 'Upload Document'}
      </button>
    </div>
  );
}

export default DocumentUploader;
