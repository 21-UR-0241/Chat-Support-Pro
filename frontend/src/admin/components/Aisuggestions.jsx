import React, { useState, useEffect, useRef } from 'react';
import '../styles/Aisuggestions.css';


function AISuggestions({ conversation, messages, onSelectSuggestion }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const lastProcessedMsgId = useRef(null);

  // Editable message & admin instructions
  const [isEditing, setIsEditing] = useState(false);
  const [editedMessage, setEditedMessage] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [messageWasEdited, setMessageWasEdited] = useState(false);
  const editTextareaRef = useRef(null);

  // Get the last customer message from the messages array
  const getLastCustomerMessage = () => {
    if (!messages || messages.length === 0) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].senderType === 'customer' && !messages[i]._optimistic) {
        return messages[i];
      }
    }
    return null;
  };

  /**
   * Build a rich context object from the full conversation history.
   * This gives the AI much more to work with than a flat string.
   */
  const buildConversationContext = () => {
    if (!messages || messages.length === 0) return { chatHistory: '', analysis: {} };

    // ── Format the last 20 messages as chat history ──
    const recent = messages.slice(-20);
    const chatHistory = recent
      .map(m => {
        const role = m.senderType === 'customer' ? 'Customer' : 'Agent';
        const content = m.content || (m.fileData ? `[Sent a file: ${m.fileData?.name || 'attachment'}]` : '');
        return `${role}: ${content}`;
      })
      .join('\n');

    // ── Analyze the conversation to extract useful signals ──
    const customerMessages = messages.filter(m => m.senderType === 'customer');
    const agentMessages = messages.filter(m => m.senderType === 'agent');
    const allCustomerText = customerMessages.map(m => (m.content || '').toLowerCase()).join(' ');

    // Detect topics mentioned across the FULL conversation
    const topicKeywords = {
      order_status: ['order', 'tracking', 'shipped', 'delivery', 'deliver', 'where is', 'status', 'when will'],
      refund_return: ['refund', 'return', 'money back', 'cancel', 'cancellation', 'exchange'],
      product_issue: ['broken', 'damaged', 'defective', 'wrong item', 'missing', 'not working', 'doesn\'t work', 'issue with'],
      payment: ['payment', 'charged', 'charge', 'billing', 'invoice', 'receipt', 'credit card', 'declined'],
      discount_promo: ['discount', 'coupon', 'promo', 'code', 'sale', 'offer', 'deal'],
      product_inquiry: ['product', 'item', 'size', 'color', 'stock', 'available', 'price', 'how much'],
      shipping: ['shipping', 'ship', 'freight', 'express', 'standard', 'free shipping', 'shipping cost'],
      account: ['account', 'login', 'password', 'sign in', 'email', 'profile', 'update my'],
      complaint: ['complaint', 'unacceptable', 'terrible', 'worst', 'angry', 'frustrated', 'disappointed', 'horrible', 'disgusting', 'scam'],
      gratitude: ['thank', 'thanks', 'appreciate', 'helpful', 'great', 'awesome', 'perfect', 'solved'],
      greeting: ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening'],
    };

    const detectedTopics = [];
    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(kw => allCustomerText.includes(kw))) {
        detectedTopics.push(topic);
      }
    }

    // Detect customer sentiment
    const lastCustMsg = customerMessages.length > 0 ? customerMessages[customerMessages.length - 1] : null;
    const lastCustText = (lastCustMsg?.content || '').toLowerCase();

    const negativeWords = ['angry', 'frustrated', 'upset', 'terrible', 'horrible', 'worst', 'unacceptable', 'disappointed', 'annoyed', 'furious', 'scam', 'ridiculous', 'disgusting', 'pathetic', 'useless'];
    const positiveWords = ['thank', 'thanks', 'great', 'awesome', 'perfect', 'helpful', 'appreciate', 'amazing', 'wonderful', 'love', 'excellent', 'solved', 'happy'];
    const urgentWords = ['urgent', 'asap', 'immediately', 'emergency', 'right now', 'please hurry', 'critical', 'time sensitive'];

    const negCount = negativeWords.filter(w => lastCustText.includes(w)).length;
    const posCount = positiveWords.filter(w => lastCustText.includes(w)).length;
    const isUrgent = urgentWords.some(w => lastCustText.includes(w));

    let sentiment = 'neutral';
    if (negCount >= 2) sentiment = 'very_negative';
    else if (negCount >= 1) sentiment = 'negative';
    else if (posCount >= 2) sentiment = 'very_positive';
    else if (posCount >= 1) sentiment = 'positive';

    // Detect if the customer is asking a question
    const isQuestion = lastCustText.includes('?') ||
      /^(can |could |how |what |where |when |why |is |are |do |does |will |would |who |which |have )/.test(lastCustText.trim());

    // Detect if customer is repeating / following up
    const isRepeat = customerMessages.length >= 2 &&
      customerMessages.slice(-3).some(m => {
        const t = (m.content || '').toLowerCase();
        return t.includes('again') || t.includes('already told') || t.includes('i said') || t.includes('still') || t.includes('follow up') || t.includes('any update');
      });

    // Check if customer shared specific data
    const hasOrderNumber = /(?:order|#)\s*#?\s*\d{3,}/i.test(allCustomerText) || /#\d{3,}/.test(allCustomerText);
    const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(allCustomerText);
    const hasAttachment = customerMessages.some(m => m.fileData || m.fileUrl);

    // Conversation length
    const turnCount = messages.length;
    const isLongConversation = turnCount > 10;

    // Agent history analysis — avoid repeating what was already said/asked
    const lastAgentMsg = agentMessages.length > 0 ? agentMessages[agentMessages.length - 1] : null;
    const lastAgentText = lastAgentMsg?.content || '';
    const allAgentText = agentMessages.map(m => (m.content || '').toLowerCase()).join(' ');

    const agentAskedForOrder = allAgentText.includes('order number') || allAgentText.includes('order #');
    const agentAlreadyApologized = allAgentText.includes('sorry') || allAgentText.includes('apologize');
    const agentAskedForEmail = allAgentText.includes('email address') || allAgentText.includes('your email');
    const agentAskedForPhoto = allAgentText.includes('photo') || allAgentText.includes('picture') || allAgentText.includes('screenshot');
    const agentOfferedRefund = allAgentText.includes('refund') || allAgentText.includes('money back');
    const agentOfferedReplacement = allAgentText.includes('replacement') || allAgentText.includes('replace');

    return {
      chatHistory,
      analysis: {
        detectedTopics,
        sentiment,
        isUrgent,
        isQuestion,
        isRepeat,
        hasOrderNumber,
        hasEmail,
        hasAttachment,
        turnCount,
        isLongConversation,
        lastAgentText,
        agentAskedForOrder,
        agentAlreadyApologized,
        agentAskedForEmail,
        agentAskedForPhoto,
        agentOfferedRefund,
        agentOfferedReplacement,
        customerMessageCount: customerMessages.length,
        agentMessageCount: agentMessages.length,
      }
    };
  };

  // Track if admin has overridden the message (ref so useEffect doesn't override)
  const isEditedRef = useRef(false);
  const editedTextRef = useRef('');
  const adminNoteRef = useRef('');

  // Fetch suggestions when a NEW customer message arrives
  // (not when admin edits — that's handled separately)
  useEffect(() => {
    const lastCustomerMsg = getLastCustomerMessage();
    if (!lastCustomerMsg) {
      setSuggestions([]);
      return;
    }

    const msgId = String(lastCustomerMsg.id);
    if (msgId === lastProcessedMsgId.current) return;

    // New message arrived — reset any edits and fetch fresh
    lastProcessedMsgId.current = msgId;
    isEditedRef.current = false;
    editedTextRef.current = '';
    adminNoteRef.current = '';
    setEditedMessage('');
    setAdminNote('');
    setMessageWasEdited(false);
    setIsEditing(false);
    fetchSuggestions(lastCustomerMsg.content);
  }, [messages]);

  // Core fetch — always sends whatever text it receives
  const fetchSuggestions = async (messageText, note) => {
    if (!messageText || !messageText.trim()) return;

    setLoading(true);
    setError(null);
    setSuggestions([]);

    try {
      const { chatHistory, analysis } = buildConversationContext();

      const response = await fetch('/api/ai/suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          clientMessage: messageText.trim(),
          chatHistory,
          conversationId: conversation?.id,
          customerName: conversation?.customerName,
          customerEmail: conversation?.customerEmail,
          storeName: conversation?.storeName || conversation?.storeIdentifier,
          storeIdentifier: conversation?.storeIdentifier,
          analysis,
          adminNote: note || '',
          messageEdited: isEditedRef.current,
        }),
      });

      if (!response.ok) throw new Error('Failed to get suggestions');

      const data = await response.json();
      setSuggestions(data.suggestions || []);
    } catch (err) {
      console.error('AI suggestion error:', err);
      setError('Could not generate suggestions');
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  // Refresh button — re-fetches with current state (edited or original)
  const handleRefresh = () => {
    if (isEditedRef.current && editedTextRef.current.trim()) {
      fetchSuggestions(editedTextRef.current.trim(), adminNoteRef.current.trim());
    } else {
      const lastCustomerMsg = getLastCustomerMessage();
      if (lastCustomerMsg) {
        fetchSuggestions(lastCustomerMsg.content, adminNoteRef.current.trim());
      }
    }
  };

  const handleStartEdit = () => {
    const lastCustomerMsg = getLastCustomerMessage();
    if (lastCustomerMsg) {
      const text = isEditedRef.current ? editedTextRef.current : (lastCustomerMsg.content || '');
      setEditedMessage(text);
      setIsEditing(true);
      setTimeout(() => editTextareaRef.current?.focus(), 50);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    // Restore from refs (don't lose previous edits)
    if (!isEditedRef.current) {
      setEditedMessage('');
      setAdminNote('');
    }
  };

  // ✦ This is the key action — sends the edited text to AI
  const handleApplyEdit = () => {
    if (!editedMessage.trim()) return;

    // Save to refs so useEffect can't override
    isEditedRef.current = true;
    editedTextRef.current = editedMessage.trim();
    adminNoteRef.current = adminNote.trim();

    setIsEditing(false);
    setMessageWasEdited(true);

    // Fetch with the NEW edited text
    fetchSuggestions(editedMessage.trim(), adminNote.trim());
  };

  const handleResetToOriginal = () => {
    const lastCustomerMsg = getLastCustomerMessage();

    // Clear all edit state
    isEditedRef.current = false;
    editedTextRef.current = '';
    adminNoteRef.current = '';
    setIsEditing(false);
    setEditedMessage('');
    setMessageWasEdited(false);
    setAdminNote('');

    // Re-fetch with the original message
    if (lastCustomerMsg) {
      fetchSuggestions(lastCustomerMsg.content);
    }
  };

  const lastCustomerMsg = getLastCustomerMessage();

  if (!conversation || !lastCustomerMsg) return null;

  return (
    <div className={`ai-suggestions-panel ${collapsed ? 'collapsed' : ''}`}>
      <div className="ai-suggestions-header">
        <div className="ai-suggestions-title">
          <span className="ai-icon">✦</span>
          <span>AI Suggestions</span>
        </div>
        <div className="ai-suggestions-actions">
          <button
            className="ai-btn-icon"
            onClick={handleRefresh}
            disabled={loading}
            title="Regenerate suggestions"
            type="button"
          >
            ↻
          </button>
          <button
            className="ai-btn-icon"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expand' : 'Collapse'}
            type="button"
          >
            {collapsed ? '◂' : '▸'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="ai-suggestions-body">
          {/* ── Context: editable customer message ── */}
          <div className="ai-context-section">
            <div className="ai-context-header">
              <span className="ai-context-label">Replying to:</span>
              {!isEditing && (
                <button
                  className="ai-edit-msg-btn"
                  onClick={handleStartEdit}
                  title="Edit message to refine AI suggestions"
                  type="button"
                >
                  ✎ Edit
                </button>
              )}
              {messageWasEdited && !isEditing && (
                <button
                  className="ai-reset-msg-btn"
                  onClick={handleResetToOriginal}
                  title="Reset to original message"
                  type="button"
                >
                  ↩ Original
                </button>
              )}
            </div>

            {isEditing ? (
              <div className="ai-edit-area">
                <textarea
                  ref={editTextareaRef}
                  className="ai-edit-textarea"
                  value={editedMessage}
                  onChange={(e) => setEditedMessage(e.target.value)}
                  placeholder="Edit the customer's message..."
                  rows={3}
                />
                <textarea
                  className="ai-note-textarea"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Instructions for AI (optional): e.g. 'include refund policy', 'ask for order number', 'be more empathetic'..."
                  rows={2}
                />
                <div className="ai-edit-actions">
                  <button className="ai-edit-cancel" onClick={handleCancelEdit} type="button">
                    Cancel
                  </button>
                  <button
                    className="ai-edit-apply"
                    onClick={handleApplyEdit}
                    disabled={!editedMessage.trim()}
                    type="button"
                  >
                    ✦ Re-generate
                  </button>
                </div>
              </div>
            ) : (
              <div className={`ai-context-message ${messageWasEdited ? 'edited' : ''}`}>
                {messageWasEdited && <span className="ai-edited-badge">edited</span>}
                {(messageWasEdited ? editedMessage : lastCustomerMsg.content)
                  ? (messageWasEdited ? editedMessage : lastCustomerMsg.content).length > 150
                    ? (messageWasEdited ? editedMessage : lastCustomerMsg.content).substring(0, 150) + '...'
                    : (messageWasEdited ? editedMessage : lastCustomerMsg.content)
                  : '(file attachment)'}
                {adminNote && !isEditing && (
                  <div className="ai-note-preview">
                    <span className="ai-note-prefix">AI note:</span> {adminNote}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="ai-suggestions-list">
            {loading ? (
              <div className="ai-loading">
                <div className="ai-loading-dots">
                  <span></span><span></span><span></span>
                </div>
                <p>Generating suggestions...</p>
              </div>
            ) : error && suggestions.length === 0 ? (
              <div className="ai-error">
                <p>{error}</p>
                <button onClick={handleRefresh} type="button" className="ai-retry-btn">
                  Try Again
                </button>
              </div>
            ) : (
              suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  className="ai-suggestion-card"
                  onClick={() => onSelectSuggestion(suggestion)}
                  type="button"
                >
                  <span className="ai-suggestion-number">{index + 1}</span>
                  <span className="ai-suggestion-text">{suggestion}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AISuggestions;