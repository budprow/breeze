import React, { useEffect, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase';
import './MyNotes.css';

function MyNotes({ documentId }) {
  const [user] = useAuthState(auth);
  const [highlights, setHighlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user && documentId) {
      const fetchHighlights = async () => {
        try {
          setLoading(true);
          const highlightsColRef = collection(db, 'users', user.uid, 'documents', documentId, 'highlights');
          const q = query(highlightsColRef, orderBy('page'), orderBy('createdAt'));
          const snapshot = await getDocs(q);
          const loadedHighlights = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setHighlights(loadedHighlights);
        } catch (err) {
          setError('Failed to load highlights.');
          console.error(err);
        } finally {
          setLoading(false);
        }
      };
      fetchHighlights();
    }
  }, [user, documentId]);

  const groupedHighlights = highlights.reduce((acc, highlight) => {
    const page = highlight.page || 'N/A';
    if (!acc[page]) {
      acc[page] = [];
    }
    acc[page].push(highlight);
    return acc;
  }, {});

  if (loading) return <div className="loading-screen"><h1>Loading Notes...</h1></div>;
  if (error) return <div className="loading-screen"><h1>{error}</h1></div>;

  return (
    <div className="my-notes-container">
      <h1 className="notes-header">My Notes for Document</h1>
      {Object.keys(groupedHighlights).length > 0 ? (
        Object.entries(groupedHighlights).map(([page, notes]) => (
          <div key={page} className="page-notes">
            <h2 className="page-number-header">Page {page}</h2>
            <ul className="notes-list">
              {notes.map(note => (
                <li key={note.id} className="note-item">
                  <p className="note-text">"{note.text}"</p>
                  <span className="note-timestamp">
                    {note.createdAt?.toDate().toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))
      ) : (
        <p>No notes found for this document.</p>
      )}
    </div>
  );
}

export default MyNotes;
