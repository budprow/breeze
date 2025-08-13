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
      // Step 1: Upload the file to Firebase Storage
      const filePath = `documents/${user.uid}/${file.name}`;
      const storageRef = ref(storage, filePath);
      await uploadBytes(storageRef, file);
      console.log("File uploaded to Storage successfully!");

      // Step 2: Save the initial file record to Firestore
      const docRef = await addDoc(collection(db, 'users', user.uid, 'documents'), {
        name: file.name,
        filePath: filePath,
        createdAt: serverTimestamp(),
        ownerId: user.uid
      });
      console.log("File record saved to Firestore with ID:", docRef.id);

      alert("File uploaded successfully! The AI is now analyzing it for key concepts.");
      onFileChange({ target: { files: [null] } }); 

      // Trigger the backend processing in the background.
      console.log("Triggering background AI processing for key concepts...");
      api.post('/api/documents/process', {
        documentId: docRef.id,
        filePath: filePath
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
        {/* This "accept" attribute tells the browser to only allow PDF files */}
        <input type="file" onChange={onFileChange} style={{ display: 'none' }} accept=".pdf" />
      </label>
      
      <button onClick={handleUploadAndSave} disabled={uploading || !file} className="action-btn generate-btn">
        {uploading ? 'Uploading & Processing...' : 'Upload Document'}
      </button>
    </div>
  );
}

export default DocumentUploader;
