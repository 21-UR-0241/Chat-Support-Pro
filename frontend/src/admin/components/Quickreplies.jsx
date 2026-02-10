import React, { useState, useRef, useEffect } from 'react';
import '../styles/QuickReplies.css';


function QuickReplies({
  templates,
  onUseTemplate,
  onAddTemplate,
  onDeleteTemplate,
  onSaveTemplate,
  loading,
  isOpen,
  onToggle,
}) {
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editContent, setEditContent] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newContent, setNewContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const panelRef = useRef(null);
  const searchRef = useRef(null);

  // Focus search when opened
  useEffect(() => {
    if (isOpen && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 100);
    }
    if (!isOpen) {
      setEditingId(null);
      setShowAddForm(false);
      setSearchQuery('');
    }
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onToggle();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, onToggle]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        if (editingId) { setEditingId(null); return; }
        if (showAddForm) { setShowAddForm(false); return; }
        onToggle();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, editingId, showAddForm, onToggle]);

  const filteredTemplates = (templates || []).filter(t => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (t.name || '').toLowerCase().includes(q) || (t.content || '').toLowerCase().includes(q);
  });

  const handleStartEdit = (template, e) => {
    e.stopPropagation();
    setEditingId(template.id);
    setEditName(template.name || '');
    setEditContent(template.content || '');
    setShowAddForm(false);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim() || !editContent.trim() || saving) return;
    try {
      setSaving(true);
      await onSaveTemplate(editingId, { name: editName.trim(), content: editContent.trim() });
      setEditingId(null);
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddNew = async () => {
    if (!newName.trim() || !newContent.trim() || saving) return;
    try {
      setSaving(true);
      await onAddTemplate({ name: newName.trim(), content: newContent.trim() });
      setNewName('');
      setNewContent('');
      setShowAddForm(false);
    } catch (err) {
      console.error('Failed to add:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (templateId, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this quick reply?')) return;
    await onDeleteTemplate(templateId);
    if (editingId === templateId) setEditingId(null);
  };

  const handleUse = (template) => {
    onUseTemplate(template);
    onToggle();
  };

  const handleFormKeyDown = (e, action) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); action(); }
  };

  if (!isOpen) return null;

  return (
    <div className="qr-popup-overlay">
      <div className="qr-popup" ref={panelRef}>
        {/* Header */}
        <div className="qr-popup-header">
          <div className="qr-popup-title">
            <span className="qr-popup-icon">⚡</span>
            <span>Quick Replies</span>
            <span className="qr-popup-count">{templates?.length || 0}</span>
          </div>
          <button className="qr-popup-close" onClick={onToggle} type="button">✕</button>
        </div>

        {/* Search */}
        <div className="qr-popup-search">
          <input
            ref={searchRef}
            type="text"
            placeholder="Search replies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="qr-search-input"
          />
          {searchQuery && (
            <button className="qr-search-clear" onClick={() => setSearchQuery('')} type="button">✕</button>
          )}
        </div>

        {/* List */}
        <div className="qr-popup-list">
          {filteredTemplates.length === 0 && !showAddForm ? (
            <div className="qr-popup-empty">
              {searchQuery ? (
                <p>No replies match "{searchQuery}"</p>
              ) : (
                <>
                  <p>No quick replies yet</p>
                  <button
                    className="qr-popup-empty-add"
                    onClick={() => setShowAddForm(true)}
                    type="button"
                  >
                    + Create your first reply
                  </button>
                </>
              )}
            </div>
          ) : (
            filteredTemplates.map((template) => (
              <div key={template.id}>
                {editingId === template.id ? (
                  /* ── Inline edit form ── */
                  <div className="qr-item-form">
                    <input
                      type="text"
                      className="qr-form-name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Label"
                      autoFocus
                    />
                    <textarea
                      className="qr-form-content"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      onKeyDown={(e) => handleFormKeyDown(e, handleSaveEdit)}
                      placeholder="Message content..."
                      rows={3}
                    />
                    <div className="qr-form-actions">
                      <button className="qr-form-cancel" onClick={() => setEditingId(null)} type="button">Cancel</button>
                      <button
                        className="qr-form-save"
                        onClick={handleSaveEdit}
                        disabled={!editName.trim() || !editContent.trim() || saving}
                        type="button"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── Reply item ── */
                  <div className="qr-item" onClick={() => handleUse(template)}>
                    <div className="qr-item-body">
                      <div className="qr-item-name">{template.name}</div>
                      <div className="qr-item-preview">{template.content}</div>
                    </div>
                    <div className="qr-item-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="qr-item-btn edit"
                        onClick={(e) => handleStartEdit(template, e)}
                        title="Edit"
                        type="button"
                      >
                        ✎
                      </button>
                      <button
                        className="qr-item-btn delete"
                        onClick={(e) => handleDelete(template.id, e)}
                        title="Delete"
                        type="button"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}

          {/* ── Add new form ── */}
          {showAddForm && (
            <div className="qr-item-form add-form">
              <input
                type="text"
                className="qr-form-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Label (e.g. Greeting, Refund Policy)"
                autoFocus
              />
              <textarea
                className="qr-form-content"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                onKeyDown={(e) => handleFormKeyDown(e, handleAddNew)}
                placeholder="Message content..."
                rows={3}
              />
              <div className="qr-form-actions">
                <button className="qr-form-cancel" onClick={() => { setShowAddForm(false); setNewName(''); setNewContent(''); }} type="button">Cancel</button>
                <button
                  className="qr-form-save"
                  onClick={handleAddNew}
                  disabled={!newName.trim() || !newContent.trim() || saving}
                  type="button"
                >
                  {saving ? 'Saving...' : 'Add Reply'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!showAddForm && (
          <div className="qr-popup-footer">
            <button
              className="qr-popup-add-btn"
              onClick={() => { setShowAddForm(true); setEditingId(null); }}
              type="button"
            >
              + New Quick Reply
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default QuickReplies;