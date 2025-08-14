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
      // The emulator requires the full bucket name to be included in the path,
      // while the live version does not. We can get the bucket name directly
      // from the storage instance to make this work in both environments.
      const bucket = storage.ref().bucket;
      const filePath = `gs://${bucket}/documents/${user.uid}/${file.name}`;
      
      const storageRef = ref(storage, filePath);
      await uploadBytes(storageRef, file);
      console.log("File uploaded to Storage successfully!");

      const docRef = await addDoc(collection(db, 'users', user.uid, 'documents'), {
        name: file.name,
        // We save the full gs:// path to Firestore
        filePath: filePath,
        createdAt: serverTimestamp(),
        ownerId: user.uid
      });
      console.log("File record saved to Firestore with ID:", docRef.id);

      alert("File uploaded successfully! The AI is now analyzing it for key concepts.");
      onFileChange({ target: { files: [null] } }); 

      api.post('/api/documents/process', {
        documentId: docRef.id,
        // We send the full gs:// path to the backend function
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
        <input type="file" onChange={onFileChange} style={{ display: 'none' }} accept=".pdf" />
      </label>
      
      <button onClick={handleUploadAndSave} disabled={uploading || !file} className="action-btn generate-btn">
        {uploading ? 'Uploading & Processing...' : 'Upload Document'}
      </button>
    </div>
  );
}

export default DocumentUploader;
