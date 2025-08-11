import React, { useState, useEffect } from 'react';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, query, doc, deleteDoc } from 'firebase/firestore';
import { ref, deleteObject, getStorage, getDownloadURL } from 'firebase/storage';
import { db } from '../firebase';
import DocumentUploader from './DocumentUploader';
import QuizList from './QuizList';
import './Dashboard.css';

function Dashboard({ user }) {
    // State for the file uploader
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');

    // This is the single source of truth for the user's documents.
    // It listens for real-time updates from Firestore.
    const [docsValue, docsLoading, docsError] = useCollection(
        user ? query(collection(db, 'users', user.uid, 'documents')) : null
    );

    // This state will hold the download URLs for our documents.
    // We keep it separate to prevent re-fetching every time the list re-renders.
    const [docUrls, setDocUrls] = useState({});

    const storage = getStorage();

    // This effect runs whenever the list of documents changes.
    // It fetches the download URL for any new document that doesn't have one yet.
    useEffect(() => {
        if (docsValue) {
            docsValue.docs.forEach(doc => {
                // If we don't already have a URL for this doc, fetch it.
                if (!docUrls[doc.id]) {
                    const docData = doc.data();
                    const fileRef = ref(storage, docData.filePath);
                    getDownloadURL(fileRef)
                        .then(url => {
                            setDocUrls(prevUrls => ({ ...prevUrls, [doc.id]: url }));
                        })
                        .catch(err => {
                            console.error("Failed to get URL for", docData.name, err);
                            // Set a placeholder to prevent re-fetching on every render
                            setDocUrls(prevUrls => ({ ...prevUrls, [doc.id]: 'error' }));
                        });
                }
            });
        }
    }, [docsValue, docUrls, storage]);


    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
    };

    // The uploader component now handles the entire upload logic.
    // This `onUpload` prop is just to manage the "Uploading..." UI state.
    const handleUploadStateChange = (isUploading) => {
        setUploading(isUploading);
        if (!isUploading) {
            setFile(null); // Clear the file input after upload finishes
        }
    };

    // This is the new, robust delete handler.
    const handleDelete = async (doc) => {
        const docData = doc.data();
        if (!window.confirm(`Are you sure you want to delete ${docData.name}?`)) return;

        try {
            // Step 1: Create a reference to the file in Storage using the exact filePath.
            const fileRef = ref(storage, docData.filePath);
            
            // Step 2: Delete the file from Storage.
            await deleteObject(fileRef);
            console.log("File deleted from Storage.");

            // Step 3: Delete the document record from Firestore.
            await deleteDoc(doc.ref);
            console.log("Document record deleted from Firestore.");

        } catch (error) {
            console.error("Error deleting document:", error);
            // This handles the specific error you saw. If the file is already gone from
            // storage for some reason, we can still try to delete the database record.
            if (error.code === 'storage/object-not-found') {
                console.warn("File not found in Storage, but attempting to delete Firestore record anyway.");
                try {
                    await deleteDoc(doc.ref);
                    console.log("Orphaned document record deleted from Firestore.");
                } catch (dbError) {
                    console.error("Failed to delete orphaned Firestore record:", dbError);
                }
            } else {
                setError("Failed to delete document. See console for details.");
            }
        }
    };

    return (
        <div className="dashboard-container">
            <div className="dashboard-section">
                <div className="explanation-box">
                    <h2>Welcome to Your Dashboard</h2>
                    <p>Upload your documents here to get started.</p>
                </div>
                <DocumentUploader 
                    file={file}
                    onFileChange={handleFileChange}
                    onUpload={handleUploadStateChange}
                    uploading={uploading}
                />
            </div>

            <div className="dashboard-section">
                <h3>Your Documents</h3>
                <div className="document-list">
                    {docsLoading && <span>Loading documents...</span>}
                    {docsError && <strong className="error-message">Error loading documents.</strong>}
                    <ul>
                        {docsValue && docsValue.docs.map((doc) => {
                            const docData = doc.data();
                            const url = docUrls[doc.id];

                            return (
                                <li key={doc.id} className="document-item">
                                    <span>{docData.name}</span>
                                    <div className="document-actions">
                                        {/* The Read button is only shown when its URL is ready */}
                                        {url && url !== 'error' && (
                                            <a 
                                                href={`/read/${doc.id}`}
                                                className="action-btn"
                                                style={{backgroundColor: '#007bff'}}
                                            >
                                                Read
                                            </a>
                                        )}
                                        <button onClick={() => alert('Generate Quiz coming soon!')} className="action-btn generate-btn">
                                            Generate Quiz
                                        </button>
                                        <button onClick={() => handleDelete(doc)} className="action-btn delete-btn">
                                            Delete
                                        </button>
                                    </div>
                                </li>
                            );
                        })}
                        {docsValue && docsValue.docs.length === 0 && !docsLoading && (
                            <p className="no-documents">You haven't uploaded any documents yet.</p>
                        )}
                    </ul>
                </div>
            </div>

            <div className="dashboard-section">
                <QuizList user={user} />
            </div>
        </div>
    );
}

export default Dashboard;
