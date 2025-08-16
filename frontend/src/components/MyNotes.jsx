import React, { useEffect, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { collection, getDocs, query, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import api from '../api';
import './MyNotes.css';

function MyNotes({ documentId }) {
  const [user] = useAuthState(auth);
  const [highlights, setHighlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedNotes, setSelectedNotes] = useState([]);
  const [flashcards, setFlashcards] = useState([]);
  const [showFlashcardsModal, setShowFlashcardsModal] = useState(false);
  const [generatingFlashcards, setGeneratingFlashcards] = useState(false);
  const [currentFlashcardIndex, setCurrentFlashcardIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [flashcardType, setFlashcardType] = useState('regular'); // 'regular' or 'multiple-choice'
  const [learnedFilter, setLearnedFilter] = useState('all'); // 'all', 'learned', 'unlearned'

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

  const handleNoteSelection = (noteId) => {
    setSelectedNotes(prev => 
      prev.includes(noteId) 
        ? prev.filter(id => id !== noteId)
        : [...prev, noteId]
    );
  };

  const handleGenerateFlashcards = async () => {
    if (selectedNotes.length === 0) {
      alert('Please select at least one note to generate flashcards.');
      return;
    }

    setGeneratingFlashcards(true);
    try {
      const selectedTexts = highlights
        .filter(highlight => selectedNotes.includes(highlight.id))
        .map(highlight => highlight.text);

      const response = await api.post('/api/generate-flashcards', {
        selectedTexts,
        flashcardType
      });

      setFlashcards(response.data.flashcards);
      setShowFlashcardsModal(true);
      setCurrentFlashcardIndex(0);
      setShowBack(false);
    } catch (err) {
      console.error('Error generating flashcards:', err);
      alert('Failed to generate flashcards. Please try again.');
    } finally {
      setGeneratingFlashcards(false);
    }
  };

  const handleMarkAsLearned = async () => {
    if (selectedNotes.length === 0) {
      alert('Please select at least one note to mark as learned.');
      return;
    }

    try {
      const updatePromises = selectedNotes.map(noteId => {
        const noteRef = doc(db, 'users', user.uid, 'documents', documentId, 'highlights', noteId);
        return updateDoc(noteRef, { 
          isLearned: true,
          learnedAt: new Date()
        });
      });

      await Promise.all(updatePromises);

      // Update local state
      setHighlights(prev => 
        prev.map(highlight => 
          selectedNotes.includes(highlight.id) 
            ? { ...highlight, isLearned: true, learnedAt: { toDate: () => new Date() } }
            : highlight
        )
      );

      setSelectedNotes([]);
      alert('Selected notes marked as learned!');
    } catch (err) {
      console.error('Error marking notes as learned:', err);
      alert('Failed to mark notes as learned. Please try again.');
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedNotes.length === 0) {
      alert('Please select at least one note to delete.');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedNotes.length} selected note(s)? This action cannot be undone.`)) {
      return;
    }

    try {
      const deletePromises = selectedNotes.map(noteId => {
        const noteRef = doc(db, 'users', user.uid, 'documents', documentId, 'highlights', noteId);
        return deleteDoc(noteRef);
      });

      await Promise.all(deletePromises);

      // Update local state
      setHighlights(prev => prev.filter(highlight => !selectedNotes.includes(highlight.id)));
      setSelectedNotes([]);
      alert('Selected notes deleted successfully!');
    } catch (err) {
      console.error('Error deleting notes:', err);
      alert('Failed to delete notes. Please try again.');
    }
  };

  const nextFlashcard = () => {
    // Infinite loop - go to first card after last card
    setCurrentFlashcardIndex(prev => (prev + 1) % flashcards.length);
    setShowBack(false);
  };

  const prevFlashcard = () => {
    // Infinite loop - go to last card when going back from first card
    setCurrentFlashcardIndex(prev => prev === 0 ? flashcards.length - 1 : prev - 1);
    setShowBack(false);
  };

  const toggleCardSide = () => {
    setShowBack(prev => !prev);
  };

  const closeFlashcardsModal = () => {
    setShowFlashcardsModal(false);
    setCurrentFlashcardIndex(0);
    setShowBack(false);
  };

  const groupedHighlights = highlights.reduce((acc, highlight) => {
    const page = highlight.page || 'N/A';
    if (!acc[page]) {
      acc[page] = [];
    }
    acc[page].push(highlight);
    return acc;
  }, {});

  // Filter highlights based on learned status
  const filteredHighlights = highlights.filter(highlight => {
    if (learnedFilter === 'learned') return highlight.isLearned;
    if (learnedFilter === 'unlearned') return !highlight.isLearned;
    return true; // 'all' - show everything
  });

  const filteredGroupedHighlights = filteredHighlights.reduce((acc, highlight) => {
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
      
      {/* Filter Controls */}
      <div className="filter-controls">
        <div className="filter-group">
          <label htmlFor="learned-filter">Filter by Status:</label>
          <select 
            id="learned-filter"
            value={learnedFilter}
            onChange={(e) => setLearnedFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Notes</option>
            <option value="unlearned">Not Learned</option>
            <option value="learned">Learned</option>
          </select>
        </div>
      </div>

      {/* Instructions Panel */}
      <div className="instructions-panel">
        <h3>How to Use Your Notes:</h3>
        <div className="instructions-grid">
          <div className="instruction-item">
            <div className="instruction-icon">☑️</div>
            <div className="instruction-text">
              <strong>Select Notes:</strong> Check the boxes next to notes you want to work with
            </div>
          </div>
          <div className="instruction-item">
            <div className="instruction-icon">🃏</div>
            <div className="instruction-text">
              <strong>Generate Flashcards:</strong> Create AI-powered study cards from selected notes
            </div>
          </div>
          <div className="instruction-item">
            <div className="instruction-icon">✅</div>
            <div className="instruction-text">
              <strong>Mark as Learned:</strong> Gray out notes you've mastered (with timestamp)
            </div>
          </div>
          <div className="instruction-item">
            <div className="instruction-icon">🗑️</div>
            <div className="instruction-text">
              <strong>Delete Selected:</strong> Remove notes you no longer need
            </div>
          </div>
        </div>
      </div>
      
      {/* Flashcard Type Selection */}
      <div className="flashcard-options">
        <label>Flashcard Type:</label>
        <div className="radio-group">
          <label className="radio-option">
            <input
              type="radio"
              value="regular"
              checked={flashcardType === 'regular'}
              onChange={(e) => setFlashcardType(e.target.value)}
            />
            Regular Flashcards
          </label>
          <label className="radio-option">
            <input
              type="radio"
              value="multiple-choice"
              checked={flashcardType === 'multiple-choice'}
              onChange={(e) => setFlashcardType(e.target.value)}
            />
            Multiple Choice Questions
          </label>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="action-buttons">
        <button 
          className="action-btn generate-btn"
          onClick={handleGenerateFlashcards}
          disabled={selectedNotes.length === 0 || generatingFlashcards}
        >
          {generatingFlashcards ? 'Generating...' : `Generate ${flashcardType === 'multiple-choice' ? 'Quiz' : 'Flashcards'}`}
        </button>
        <button 
          className="action-btn learned-btn"
          onClick={handleMarkAsLearned}
          disabled={selectedNotes.length === 0}
        >
          Mark as Learned
        </button>
        <button 
          className="action-btn delete-btn"
          onClick={handleDeleteSelected}
          disabled={selectedNotes.length === 0}
        >
          Delete Selected
        </button>
      </div>

      {/* Selected Count */}
      {selectedNotes.length > 0 && (
        <div className="selected-count">
          {selectedNotes.length} note(s) selected
        </div>
      )}

      {/* Notes Display */}
      {Object.keys(filteredGroupedHighlights).length > 0 ? (
        Object.entries(filteredGroupedHighlights).map(([page, notes]) => (
          <div key={page} className="page-notes">
            <h2 className="page-number-header">Page {page}</h2>
            <ul className="notes-list">
              {notes.map(note => (
                <li key={note.id} className={`note-item ${note.isLearned ? 'learned' : ''}`}>
                  <div className="note-content">
                    <div className="note-header">
                      <input
                        type="checkbox"
                        className="note-checkbox"
                        checked={selectedNotes.includes(note.id)}
                        onChange={() => handleNoteSelection(note.id)}
                      />
                      {note.isLearned && <span className="learned-indicator">✓</span>}
                    </div>
                    <div className="note-body">
                      <p className="note-text">"{note.text}"</p>
                      <div className="note-timestamps">
                        <span className="note-timestamp">
                          Added: {note.createdAt?.toDate().toLocaleString()}
                        </span>
                        {note.isLearned && note.learnedAt && (
                          <span className="learned-timestamp">
                            Learned: {note.learnedAt.toDate().toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))
      ) : (
        <div className="no-notes">
          {learnedFilter === 'all' ? 
            "No notes found for this document." : 
            `No ${learnedFilter} notes found.`
          }
        </div>
      )}

      {/* Enhanced Flashcards Modal */}
      {showFlashcardsModal && (
        <div className="modal-overlay" onClick={closeFlashcardsModal}>
          <div className="flashcards-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{flashcardType === 'multiple-choice' ? 'Quiz Questions' : 'Flashcards'}</h2>
              <button 
                className="close-btn"
                onClick={closeFlashcardsModal}
              >
                ×
              </button>
            </div>
            
            {flashcards.length > 0 && (
              <div className="flashcard-container">
                <div className="flashcard-counter">
                  {currentFlashcardIndex + 1} of {flashcards.length}
                </div>
                
                <div className="flashcard" onClick={toggleCardSide}>
                  <div className="flashcard-content">
                    {flashcardType === 'multiple-choice' ? (
                      // Multiple Choice Display
                      showBack ? (
                        <div className="flashcard-back">
                          <div className="card-label">Correct Answer:</div>
                          <div className="card-text">{flashcards[currentFlashcardIndex].correctAnswer}</div>
                          {flashcards[currentFlashcardIndex].explanation && (
                            <div className="explanation">
                              <strong>Explanation:</strong> {flashcards[currentFlashcardIndex].explanation}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flashcard-front">
                          <div className="card-label">Question:</div>
                          <div className="card-text">{flashcards[currentFlashcardIndex].question}</div>
                          <div className="multiple-choice-options">
                            {flashcards[currentFlashcardIndex].options?.map((option, index) => (
                              <div key={index} className="option">
                                {String.fromCharCode(65 + index)}. {option}
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    ) : (
                      // Regular Flashcard Display
                      showBack ? (
                        <div className="flashcard-back">
                          <div className="card-label">Answer:</div>
                          <div className="card-text">{flashcards[currentFlashcardIndex].back}</div>
                        </div>
                      ) : (
                        <div className="flashcard-front">
                          <div className="card-label">Question:</div>
                          <div className="card-text">{flashcards[currentFlashcardIndex].front}</div>
                        </div>
                      )
                    )}
                  </div>
                  <div className="flip-hint">Click to flip</div>
                </div>
                
                <div className="flashcard-controls">
                  <button 
                    className="nav-btn"
                    onClick={prevFlashcard}
                  >
                    Previous
                  </button>
                  <button className="flip-btn" onClick={toggleCardSide}>
                    {showBack ? 'Show Question' : 'Show Answer'}
                  </button>
                  <button 
                    className="nav-btn"
                    onClick={nextFlashcard}
                  >
                    Next
                  </button>
                </div>

                <div className="modal-footer">
                  <button 
                    className="close-modal-btn"
                    onClick={closeFlashcardsModal}
                  >
                    Close Study Session
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default MyNotes;
