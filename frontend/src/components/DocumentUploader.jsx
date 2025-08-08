import React from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage'; // Use uploadBytes instead of uploadBytesResumable
import { db, storage, auth } from '../firebase';
import './DocumentUploader.css';

function DocumentUploader({ file, onFileChange, onUpload, uploading }) {

  // This is the new, simplified upload handler.
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

    // Signal to the Dashboard that the upload process has started.
    onUpload(true); 

    try {
      // Step 1: Define the correct, secure path for the file in Storage.
      const filePath = `documents/${user.uid}/${file.name}`;
      const storageRef = ref(storage, filePath);

      // Step 2: Directly upload the file and wait for it to complete.
      // This is simpler and more robust than tracking progress states.
      await uploadBytes(storageRef, file);
      console.log("File uploaded to Storage successfully!");

      // Step 3: Now that the file is uploaded, save its record to Firestore.
      // This path EXACTLY matches the path in our firestore.rules file.
      await addDoc(collection(db, 'users', user.uid, 'documents'), {
        name: file.name,
        filePath: filePath,
        createdAt: serverTimestamp(),
        ownerId: user.uid
      });

      console.log("File record saved to Firestore!");
      alert("File uploaded successfully!");
      onFileChange({ target: { files: [null] } }); // Clear the file input

    } catch (error) {
        // This will catch errors from either the Storage upload or the Firestore save.
        console.error("An error occurred during the upload process:", error);
        alert("Upload failed. Please check the console for details.");
    } finally {
        // Signal that the upload process is finished, whether it succeeded or failed.
        onUpload(false);
    }
  };


  return (
    <div className="upload-step">
      <h3>Upload a Document</h3>
      <label className="uploader-label">
        {file ? `Selected: ${file.name}` : 'Choose Document (PDF, IMG)'}
        <input type="file" onChange={onFileChange} style={{ display: 'none' }} />
      </label>
      
      {/* The progress bar is temporarily removed to simplify the logic */}

      <button onClick={handleUploadAndSave} disabled={uploading || !file} className="action-btn generate-btn">
        {uploading ? 'Uploading...' : 'Upload and Save'}
      </button>
    </div>
  );
}

export default DocumentUploader;
