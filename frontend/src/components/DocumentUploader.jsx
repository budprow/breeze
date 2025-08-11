import React from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { db, storage, auth } from '../firebase';
import api from '../api'; // Import your api instance
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

      // --- NEW STEP 3: Trigger the backend processing ---
      console.log("Triggering backend AI processing for key concepts...");
      await api.post('/api/documents/process', {
        documentId: docRef.id,
        filePath: filePath
      });
      console.log("Backend processing triggered successfully!");
      // --- END OF NEW STEP ---

      alert("File uploaded and processed successfully!");
      onFileChange({ target: { files: [null] } }); 

    } catch (error) {
        console.error("An error occurred during the upload process:", error);
        alert("Upload failed. Please check the console for details.");
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