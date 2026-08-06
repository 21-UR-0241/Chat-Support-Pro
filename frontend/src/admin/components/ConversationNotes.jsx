

import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import '../styles/ConversationNotes.css';

// "#rrggbb" → "r, g, b" (or null for non-6-digit hex, so callers fall back to teal).
const hexToTriple = (hex) => {
  if (!hex || typeof hex !== 'string') return null;
  const c = hex.replace('#', '');
  if (c.length !== 6) return null;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return [r, g, b].some(Number.isNaN) ? null : `${r}, ${g}, ${b}`;
};

function ConversationNotes({ employee: employeeProp, employeeId, employeeName, groupColor = '#00a884', onClose }) {
  const [notes, setNotes]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [saving, setSaving]             = useState(false);
  const [viewingNote, setViewingNote]   = useState(null);

  // ── Drag state ────────────────────────────────────────────────────────────
  const dragIndexRef     = useRef(null);
  const dragOverIndexRef = useRef(null);
  const [dragIndex,     setDragIndex]     = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // ── Debounced DB save ─────────────────────────────────────────────────────
  const saveTimerRef = useRef(null);

  const saveOrderToDB = (orderedNotes) => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      api.updateNotesOrder(employeeId, orderedNotes.map(n => n.id))
        .catch(err => console.error('[Notes] Failed to persist order:', err));
    }, 600);
  };

  // ── Apply saved order from DB ─────────────────────────────────────────────
  const applyOrder = (rawNotes, savedIds = []) => {
    if (!savedIds.length) return rawNotes;
    const map = Object.fromEntries(rawNotes.map(n => [String(n.id), n]));
    const ordered = savedIds.map(id => map[String(id)]).filter(Boolean);
    // Prepend notes not yet in saved order (added from another session)
    const orderedSet = new Set(savedIds.map(String));
    rawNotes.forEach(n => { if (!orderedSet.has(String(n.id))) ordered.unshift(n); });
    return ordered;
  };

  useEffect(() => {
    loadNotes();
    return () => clearTimeout(saveTimerRef.current);
  }, []);

  const loadNotes = async () => {
    try {
      setLoading(true);
      setError(null);
      const rawNotes = await api.getEmployeeNotes(employeeId);
      const savedIds = employeeProp?.notesOrder || employeeProp?.notes_order || [];
      setNotes(applyOrder(rawNotes || [], savedIds));
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
    if (newNoteContent.length > 5000) { alert('Content too long (max 5000 characters)'); return; }
    if (newNoteTitle.length > 200)    { alert('Title too long (max 200 characters)');    return; }

    try {
      setSaving(true);
      setError(null);
      const response = await api.createNote({
        employeeId,
        title:   newNoteTitle.trim() || 'Untitled',
        content: newNoteContent.trim(),
      });
      setNotes(prev => {
        const next = [response, ...prev];
        saveOrderToDB(next);
        return next;
      });
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
    if (!confirm('Delete this note? This cannot be undone.')) return;
    try {
      await api.deleteNote(noteId);
      setNotes(prev => {
        const next = prev.filter(n => n.id !== noteId);
        saveOrderToDB(next);
        return next;
      });
      showToast('🗑️ Note deleted', 'info');
    } catch (err) {
      console.error('❌ Error deleting note:', err);
      setError('Failed to delete note');
    }
  };

  const handleCopy = async (note) => {
    try {
      await navigator.clipboard.writeText(note.content);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = note.content;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    showToast('📋 Copied to clipboard!', 'success');
  };

  const showToast = (message, type = 'success') => {
    const t = document.createElement('div');
    t.className = `note-toast note-toast-${type}`;
    t.textContent = message;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2000);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now   = new Date();
    const diffMs    = now - date;
    const diffMins  = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays  = Math.floor(diffMs / 86400000);
    if (diffMins  < 1)  return 'Just now';
    if (diffMins  < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays  < 7)  return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  // ── Group-color theming ─────────────────────────────────────────────────────
  const accent       = groupColor || '#00a884';
  const accentTriple = hexToTriple(accent) || '0, 168, 132';
  const accentVars   = { '--group-accent': accent, '--group-accent-rgb': accentTriple };

  // ── Drag handlers ─────────────────────────────────────────────────────────

  const handleDragStart = (e, index) => {
    dragIndexRef.current = index;
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index);
  };

  const handleDragEnter = (e, index) => {
    e.preventDefault();
    if (dragIndexRef.current === null || dragIndexRef.current === index) return;
    dragOverIndexRef.current = index;
    setDragOverIndex(index);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    const from = dragIndexRef.current;
    if (from === null || from === dropIndex) return;

    setNotes(prev => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(dropIndex, 0, moved);
      saveOrderToDB(next);
      return next;
    });

    resetDragState();
  };

  const handleDragEnd = () => resetDragState();

  const resetDragState = () => {
    dragIndexRef.current     = null;
    dragOverIndexRef.current = null;
    setDragIndex(null);
    setDragOverIndex(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="notes-modal-overlay" style={accentVars} onClick={onClose}>
      <div className="notes-modal-compact" onClick={(e) => e.stopPropagation()}>

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

        <div className="notes-grid-wrapper">
          {loading ? (
            <div className="notes-loading-compact">
              <div className="spinner-compact" />
              <p>Loading...</p>
            </div>
          ) : notes.length === 0 ? (
            <div className="notes-empty-compact">
              <span className="empty-icon">📝</span>
              <p>No notes yet</p>
            </div>
          ) : (
            <>
              {notes.length > 1 && (
                <p className="notes-drag-hint">⠿ Drag cards to reorder</p>
              )}
              <div className="notes-grid-compact">
                {notes.map((note, index) => {
                  const isDragging  = dragIndex === index;
                  const isDragAbove = dragOverIndex === index && dragIndex !== null && dragIndex > index;
                  const isDragBelow = dragOverIndex === index && dragIndex !== null && dragIndex < index;

                  return (
                    <div
                      key={note.id}
                      className={[
                        'note-card-compact',
                        isDragging  ? 'note-card--dragging'   : '',
                        isDragAbove ? 'note-card--drag-above' : '',
                        isDragBelow ? 'note-card--drag-below' : '',
                      ].filter(Boolean).join(' ')}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragEnter={(e) => handleDragEnter(e, index)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, index)}
                      onDragEnd={handleDragEnd}
                    >
                      <div className="note-drag-handle" title="Drag to reorder">
                        <span /><span /><span />
                      </div>

                      <div className="note-card-top">
                        <div className="note-title-row">
                          <h4 className="note-title-compact">{note.title || 'Untitled'}</h4>
                          <span className="note-number">#{notes.length - index}</span>
                        </div>
                        <div className="note-actions">
                          <button className="btn-action btn-view"   onClick={() => setViewingNote(note)} title="View full note">👁️</button>
                          <button className="btn-action btn-copy"   onClick={() => handleCopy(note)}     title="Copy note">📋</button>
                          <button className="btn-action btn-delete" onClick={() => handleDelete(note.id)} title="Delete note">🗑️</button>
                        </div>
                      </div>

                      {note.content && (
                        <div className="note-content-preview">
                          {note.content.length > 120
                            ? `${note.content.substring(0, 120)}…`
                            : note.content}
                        </div>
                      )}

                      <div className="note-card-bottom">
                        <span className="note-meta">👤 {note.employeeName}</span>
                        <span className="note-meta">🕐 {formatDate(note.createdAt)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {viewingNote && (
        <div className="view-modal-overlay" onClick={() => setViewingNote(null)}>
          <div className="view-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="view-modal-header">
              <h3>{viewingNote.title || 'Untitled'}</h3>
              <div className="view-modal-actions">
                <button className="btn-modal-action" onClick={() => handleCopy(viewingNote)}>📋 Copy</button>
                <button className="btn-modal-close"  onClick={() => setViewingNote(null)}>×</button>
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

      {/* Accents follow the store group color. Scoped under .notes-modal-overlay
          so these out-specify the base stylesheet without !important; each falls
          back to the original teal when no group color is set. */}
      <style>{`
        .notes-modal-overlay .btn-save-compact {
          background: var(--group-accent, #00a884);
          border-color: var(--group-accent, #00a884);
        }
        .notes-modal-overlay .btn-save-compact:hover:not(:disabled) { filter: brightness(0.93); }

        .notes-modal-overlay .btn-modal-action {
          background: var(--group-accent, #00a884);
          border-color: var(--group-accent, #00a884);
        }
        .notes-modal-overlay .btn-modal-action:hover { filter: brightness(0.93); }

        .notes-modal-overlay .note-title-input-compact:focus,
        .notes-modal-overlay .note-content-input-compact:focus {
          border-color: var(--group-accent, #00a884);
          box-shadow: 0 0 0 3px rgba(var(--group-accent-rgb, 0, 168, 132), 0.12);
          outline: none;
        }

        .notes-modal-overlay .note-number { color: var(--group-accent, #00a884); }
        .notes-modal-overlay .spinner-compact { border-top-color: var(--group-accent, #00a884); }
      `}</style>
    </div>
  );
}

export default ConversationNotes;


