import React, { useState, useEffect } from 'react';
import api from '../services/api';
import '../styles/ConversationNotes.css';



function ConversationNotes({ employeeId, employeeName, onClose }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [viewingNote, setViewingNote] = useState(null);

  useEffect(() => {
    loadNotes();
  }, []);

  const loadNotes = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.getEmployeeNotes(employeeId);
      setNotes(response || []);
    } catch (err) {
      console.error('❌ Error loading notes:', err);
      setError('Failed to load notes');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!newNoteTitle.trim() && !newNoteContent.trim()) {
      alert('Please enter a title or content');
      return;
    }

    if (newNoteContent.length > 5000) {
      alert('Content too long (max 5000 characters)');
      return;
    }

    if (newNoteTitle.length > 200) {
      alert('Title too long (max 200 characters)');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const response = await api.createNote({
        employeeId,
        title: newNoteTitle.trim() || 'Untitled',
        content: newNoteContent.trim()
      });

      setNotes([response, ...notes]);
      setNewNoteTitle('');
      setNewNoteContent('');
      
      showToast('✅ Note saved!', 'success');
    } catch (err) {
      console.error('❌ Error saving note:', err);
      setError('Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (noteId) => {
    if (!confirm('Delete this note? This cannot be undone.')) {
      return;
    }

    try {
      await api.deleteNote(noteId);
      setNotes(notes.filter(n => n.id !== noteId));
      showToast('🗑️ Note deleted', 'info');
    } catch (err) {
      console.error('❌ Error deleting note:', err);
      setError('Failed to delete note');
    }
  };

const handleCopy = async (note) => {
  const textToCopy = note.content;  // ✅ Only copy content
  
  try {
    await navigator.clipboard.writeText(textToCopy);
    showToast('📋 Copied to clipboard!', 'success');
  } catch (err) {
    const textarea = document.createElement('textarea');
    textarea.value = textToCopy;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showToast('📋 Copied to clipboard!', 'success');
  }
};

  const showToast = (message, type = 'success') => {
    const toast = document.createElement('div');
    toast.className = `note-toast note-toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  return (
    <div className="notes-modal-overlay" onClick={onClose}>
      <div className="notes-modal-compact" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="notes-header-compact">
          <div className="header-info">
            <h2>📝 My Notes</h2>
            <span className="notes-count">{notes.length} notes</span>
          </div>
          <button className="notes-close-btn" onClick={onClose}>×</button>
        </div>

        {error && (
          <div className="notes-error-compact">
            <span>⚠️ {error}</span>
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}

        {/* Add Note - Compact */}
        <div className="notes-add-compact">
          <input
            type="text"
            className="note-title-input-compact"
            placeholder="Title (optional)"
            value={newNoteTitle}
            onChange={(e) => setNewNoteTitle(e.target.value)}
            maxLength={200}
            disabled={saving}
          />
          <textarea
            className="note-content-input-compact"
            placeholder="What's on your mind?"
            value={newNoteContent}
            onChange={(e) => setNewNoteContent(e.target.value)}
            maxLength={5000}
            rows={3}
            disabled={saving}
          />
          <div className="add-note-footer">
            <span className="char-count">{newNoteContent.length}/5000</span>
            <button
              className="btn-save-compact"
              onClick={handleSave}
              disabled={saving || (!newNoteTitle.trim() && !newNoteContent.trim())}
            >
              {saving ? 'Saving...' : '💾 Save'}
            </button>
          </div>
        </div>

        {/* Notes Grid - Compact */}
        <div className="notes-grid-wrapper">
          {loading ? (
            <div className="notes-loading-compact">
              <div className="spinner-compact"></div>
              <p>Loading...</p>
            </div>
          ) : notes.length === 0 ? (
            <div className="notes-empty-compact">
              <span className="empty-icon">📝</span>
              <p>No notes yet</p>
            </div>
          ) : (
            <div className="notes-grid-compact">
              {notes.map((note, index) => (
                <div key={note.id} className="note-card-compact">
                  <div className="note-card-top">
                    <div className="note-title-row">
                      <h4 className="note-title-compact">{note.title || 'Untitled'}</h4>
                      <span className="note-number">#{notes.length - index}</span>
                    </div>
                    <div className="note-actions">
                      <button 
                        className="btn-action btn-view"
                        onClick={() => setViewingNote(note)}
                        title="View full note"
                      >
                        👁️
                      </button>
                      <button 
                        className="btn-action btn-copy"
                        onClick={() => handleCopy(note)}
                        title="Copy note"
                      >
                        📋
                      </button>
                      <button 
                        className="btn-action btn-delete"
                        onClick={() => handleDelete(note.id)}
                        title="Delete note"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                  
                  {note.content && (
                    <div className="note-content-preview">
                      {note.content.length > 120 
                        ? `${note.content.substring(0, 120)}...` 
                        : note.content}
                    </div>
                  )}
                  
                  <div className="note-card-bottom">
                    <span className="note-meta">
                      👤 {note.employeeName}
                    </span>
                    <span className="note-meta">
                      🕐 {formatDate(note.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* View Note Modal */}
      {viewingNote && (
        <div className="view-modal-overlay" onClick={() => setViewingNote(null)}>
          <div className="view-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="view-modal-header">
              <h3>{viewingNote.title || 'Untitled'}</h3>
              <div className="view-modal-actions">
                <button 
                  className="btn-modal-action"
                  onClick={() => handleCopy(viewingNote)}
                  title="Copy note"
                >
                  📋 Copy
                </button>
                <button 
                  className="btn-modal-close"
                  onClick={() => setViewingNote(null)}
                >
                  ×
                </button>
              </div>
            </div>
            <div className="view-modal-body">
              <div className="view-modal-content-text">
                {viewingNote.content || 'No content'}
              </div>
              <div className="view-modal-footer">
                <span>👤 {viewingNote.employeeName}</span>
                <span>•</span>
                <span>🕐 {formatDate(viewingNote.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ConversationNotes;