
import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import '../styles/Aisuggestions.css';

function AISuggestions({ conversation, messages, onSelectSuggestion }) {
  const [suggestions, setSuggestions]           = useState([]);
  const [loading, setLoading]                   = useState(false);
  const [error, setError]                       = useState(null);
  const [collapsed, setCollapsed]               = useState(false);
  const [contextLevel, setContextLevel]         = useState('none');
  const [readyToGenerate, setReadyToGenerate]   = useState(false);
  const lastProcessedMsgId                      = useRef(null);

  const [isEditing, setIsEditing]               = useState(false);
  const [editedMessage, setEditedMessage]       = useState('');
  const [adminNote, setAdminNote]               = useState('');
  const [messageWasEdited, setMessageWasEdited] = useState(false);
  const editTextareaRef                         = useRef(null);

  const [detailedModal, setDetailedModal]       = useState(null);
  const [activeTab, setActiveTab]               = useState(0);

  const [uploadedImage, setUploadedImage]       = useState(null);
  const [imageAnalyzing, setImageAnalyzing]     = useState(false);
  const [imageAnalysis, setImageAnalysis]       = useState(null);
  const [imageDismissed, setImageDismissed]     = useState(false);
  const [pasteHighlight, setPasteHighlight]     = useState(false);
  const imageInputRef                           = useRef(null);

  const isEditedRef    = useRef(false);
  const editedTextRef  = useRef('');
  const adminNoteRef   = useRef('');

  const TAB_COLORS = [
    { color: '#f59e0b' },
    { color: '#3b82f6' },
    { color: '#8b5cf6' },
  ];

  // ── Reset ALL state when conversation changes ──────────────────────────────
  useEffect(() => {
    if (!conversation?.id) return;
    setSuggestions([]);
    setError(null);
    setContextLevel('none');
    setReadyToGenerate(false);
    setIsEditing(false);
    setEditedMessage('');
    setAdminNote('');
    setMessageWasEdited(false);
    setDetailedModal(null);
    setActiveTab(0);
    if (uploadedImage?.previewUrl) URL.revokeObjectURL(uploadedImage.previewUrl);
    setUploadedImage(null);
    setImageAnalysis(null);
    setImageDismissed(false);
    lastProcessedMsgId.current = null;
    isEditedRef.current        = false;
    editedTextRef.current      = '';
    adminNoteRef.current       = '';
  }, [conversation?.id]);

  // ── Paste handler ──────────────────────────────────────────────────────────
  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      let imageItem = null;
      for (const item of items) {
        if (item.type.startsWith('image/')) { imageItem = item; break; }
      }
      if (!imageItem) return;
      e.preventDefault();
      e.stopPropagation();
      const file = imageItem.getAsFile();
      if (file) processImageFile(file);
    };
    window.addEventListener('paste', handlePaste, true);
    return () => window.removeEventListener('paste', handlePaste, true);
  }, [conversation, messages]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getLastCustomerMessage = () => {
    if (!messages?.length) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].senderType === 'customer' && !messages[i]._optimistic) return messages[i];
    }
    return null;
  };

  const assessContextQuality = () => {
    if (!messages?.length) return 'none';
    const customers = messages.filter(m => m.senderType === 'customer' && !m._optimistic).length;
    const agents    = messages.filter(m => m.senderType === 'agent'    && !m._optimistic).length;
    if (customers === 0) return 'none';
    if (customers === 1 && agents === 0) return 'minimal';
    if (customers >= 1 && agents >= 1 && customers + agents < 4) return 'basic';
    if (customers >= 2 && agents >= 2) return 'good';
    if (customers >= 3 && agents >= 3) return 'excellent';
    return 'basic';
  };

  const getContextIndicator = () => {
    const map = {
      minimal:   { text: 'First message — suggestions may be general', color: '#3b82f6' },
      basic:     { text: 'Basic context — suggestions improving',       color: '#f59e0b' },
      good:      { text: 'Good context — quality suggestions',          color: '#10b981' },
      excellent: { text: 'Excellent context — high quality suggestions', color: '#059669' },
    };
    return map[contextLevel] || null;
  };

  const buildConversationContext = () => {
    if (!messages?.length) return { chatHistory: '', analysis: {}, recentContext: null };

    const customerMessages = messages.filter(m => m.senderType === 'customer');
    const agentMessages    = messages.filter(m => m.senderType === 'agent');
    const allCustomerText  = customerMessages.map(m => (m.content || '').toLowerCase()).join(' ');
    const lastCustomerText = customerMessages.at(-1)?.content || '';

    const lastCustomerMessages = customerMessages.filter(m => !m._optimistic).slice(-2);
    const lastAgentMessages    = agentMessages.filter(m => !m._optimistic).slice(-2);

    const chatHistory = messages.slice(-40).map(m => {
      const role    = m.senderType === 'customer' ? 'Customer' : 'Agent';
      const content = m.content || (m.fileData ? `[File: ${m.fileData?.name || 'attachment'}]` : '');
      return `${role}: ${content}`;
    }).join('\n');

    const agentStyleSamples = agentMessages
      .filter(m => !m._optimistic && m.content && m.content.trim().length > 8)
      .slice(-15)
      .map(m => m.content.trim());

    const orderNumberMatch = allCustomerText.match(/(?:order|#)\s*#?\s*(\d{4,})/i)
      || allCustomerText.match(/#(\d{4,})/)
      || allCustomerText.match(/\b(\d{5,})\b/);
    const orderNumber   = orderNumberMatch?.[1] || null;
    const emailMatch    = allCustomerText.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
    const customerEmail = emailMatch?.[0] || null;

    const detectedIssue = (
      /broken|damaged|defective|cracked|shattered|crushed/i.test(allCustomerText)                                         ? 'damaged'    :
      /wrong item|incorrect|not what i ordered|different|ordered.{0,40}received|sent.{0,30}instead/i.test(allCustomerText) ? 'wrong_item' :
      /missing|didn't receive|never arrived|lost/i.test(allCustomerText)                                                   ? 'missing'    :
      /late|delayed|taking too long|still waiting/i.test(allCustomerText)                                                  ? 'late'       :
      /poor quality|cheap|not as described|disappointed with quality/i.test(allCustomerText)                               ? 'quality'    :
      null
    );

    const customerWants = {
      refund:      /refund|money back/i.test(allCustomerText),
      replacement: /replacement|replace|send another|new one/i.test(allCustomerText),
      tracking:    /tracking|where is|status|when will/i.test(allCustomerText),
      help:        /help|assist|support/i.test(allCustomerText),
    };

    const topicKeywords = {
      order_status:    ['order', 'tracking', 'shipped', 'delivery', 'deliver', 'where is', 'status', 'when will'],
      refund_return:   ['refund', 'return', 'money back', 'cancel', 'cancellation', 'exchange'],
      product_issue:   ['broken', 'damaged', 'defective', 'wrong item', 'missing', 'not working', "doesn't work", 'issue with', 'ordered', 'received wrong', 'sent wrong'],
      payment:         ['payment', 'charged', 'charge', 'billing', 'invoice', 'receipt', 'credit card', 'declined'],
      discount_promo:  ['discount', 'coupon', 'promo', 'code', 'sale', 'offer', 'deal'],
      product_inquiry: ['product', 'item', 'size', 'color', 'stock', 'available', 'price', 'how much'],
      shipping:        ['shipping', 'ship', 'freight', 'express', 'standard', 'free shipping', 'shipping cost'],
      account:         ['account', 'login', 'password', 'sign in', 'email', 'profile', 'update my'],
      complaint:       ['complaint', 'unacceptable', 'terrible', 'worst', 'angry', 'frustrated', 'disappointed', 'horrible', 'scam'],
      gratitude:       ['thank', 'thanks', 'appreciate', 'helpful', 'great', 'awesome', 'perfect', 'solved'],
      greeting:        ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening'],
    };

    const currentMsgLower = lastCustomerText.toLowerCase();
    const detectedTopics = Object.entries(topicKeywords)
      .filter(([topic, kws]) => {
        if (kws.some(kw => currentMsgLower.includes(kw))) return true;
        const statefulTopics = ['order_status', 'shipping', 'refund_return', 'product_issue'];
        return statefulTopics.includes(topic) && kws.some(kw => allCustomerText.includes(kw));
      })
      .map(([topic]) => topic);

    const availableCustomerText = lastCustomerMessages.map(m => (m.content || '').toLowerCase()).join(' ');
    const negCount = ['angry','frustrated','upset','terrible','horrible','worst','unacceptable','disappointed','annoyed','furious','scam','ridiculous','disgusting','pathetic','useless']
      .filter(w => availableCustomerText.includes(w)).length;
    const posCount = ['thank','thanks','great','awesome','perfect','helpful','appreciate','amazing','wonderful','love','excellent','solved','happy']
      .filter(w => availableCustomerText.includes(w)).length;
    const isUrgent = ['urgent','asap','immediately','emergency','right now','please hurry','critical','time sensitive']
      .some(w => availableCustomerText.includes(w));

    const sentiment = negCount >= 2 ? 'very_negative' : negCount >= 1 ? 'negative' :
                      posCount >= 2 ? 'very_positive'  : posCount >= 1 ? 'positive' : 'neutral';

    const isQuestion = lastCustomerMessages.some(m => {
      const t = (m.content || '').toLowerCase();
      return t.includes('?') || /^(can |could |how |what |where |when |why |is |are |do |does |will |would |who |which |have )/.test(t.trim());
    });

    const isRepeat = customerMessages.length >= 2 &&
      customerMessages.slice(-3).some(m => {
        const t = (m.content || '').toLowerCase();
        return ['again','already told','i said','still','follow up','any update'].some(w => t.includes(w));
      });

    const wordCount       = lastCustomerText.split(/\s+/).filter(Boolean).length;
    const messageRichness = wordCount >= 30 ? 'very_detailed' : wordCount >= 15 ? 'detailed' : wordCount >= 5 ? 'brief' : 'very_brief';

    const allAgentText       = agentMessages.map(m => (m.content || '').toLowerCase()).join(' ');
    const availableAgentText = lastAgentMessages.map(m => (m.content || '').toLowerCase()).join(' ');

    return {
      chatHistory,
      agentStyleSamples,
      recentContext: {
        lastCustomerMessages: lastCustomerMessages.map(m => m.content || '[attachment]'),
        lastAgentMessages:    lastAgentMessages.map(m => m.content || ''),
        contextQuality: assessContextQuality(),
        messageRichness, detectedIssue, customerWants,
      },
      analysis: {
        detectedTopics, sentiment, isUrgent, isQuestion, isRepeat,
        hasOrderNumber: !!orderNumber, orderNumber,
        hasEmail: !!customerEmail, customerEmail,
        hasAttachment: customerMessages.some(m => m.fileData || m.fileUrl),
        turnCount: messages.length,
        isLongConversation: messages.length > 10,
        lastAgentText: agentMessages.at(-1)?.content || '',
        agentAskedForOrder:      allAgentText.includes('order number') || allAgentText.includes('order #'),
        agentAlreadyApologized:  availableAgentText.includes('sorry') || availableAgentText.includes('apologize'),
        agentAskedForEmail:      allAgentText.includes('email address') || allAgentText.includes('your email'),
        agentAskedForPhoto:      allAgentText.includes('photo') || allAgentText.includes('picture') || allAgentText.includes('screenshot'),
        agentOfferedRefund:      availableAgentText.includes('refund') || availableAgentText.includes('money back'),
        agentOfferedReplacement: availableAgentText.includes('replacement') || availableAgentText.includes('replace'),
        customerMessageCount: customerMessages.length,
        agentMessageCount:    agentMessages.length,
        messageRichness, detectedIssue, customerWants,
      },
    };
  };

  const buildPayload = (clientMessage, extra = {}) => {
    const { chatHistory, agentStyleSamples, analysis, recentContext } = buildConversationContext();
    return {
      clientMessage: clientMessage.trim(),
      chatHistory, agentStyleSamples, recentContext, analysis,
      conversationId:  conversation?.id,
      customerName:    conversation?.customerName,
      customerEmail:   conversation?.customerEmail,
      storeName:       conversation?.storeName || conversation?.storeIdentifier,
      storeIdentifier: conversation?.storeIdentifier,
      adminNote:       adminNoteRef.current || '',
      messageEdited:   isEditedRef.current,
      brainSettings:   (() => { try { return JSON.parse(localStorage.getItem('brain_suggestion_settings') || '{}'); } catch { return {}; } })(),
      ...(uploadedImage && !imageDismissed ? {
        adminImage: { base64: uploadedImage.base64, mimeType: uploadedImage.mimeType, name: uploadedImage.name },
        imageAnalysis: imageAnalysis || null,
      } : {}),
      ...extra,
    };
  };

  const postToAI = async (payload) => {
    const baseUrl = api.baseUrl || import.meta.env.VITE_API_URL || '';
    const res = await fetch(`${baseUrl}/api/ai/suggestions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify(payload),
    });
    if (!res.ok) { const text = await res.text(); throw new Error(`Server ${res.status}: ${text.substring(0, 100)}`); }
    return res.json();
  };

  // ── Image handling ─────────────────────────────────────────────────────────
  const processImageFile = async (file) => {
    const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const mimeType = ALLOWED.includes(file.type) ? file.type : 'image/png';
    if (!ALLOWED.includes(mimeType)) { setError('Unsupported image type. Use JPG, PNG, or WebP.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Image must be under 5 MB.'); return; }

    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result.split(',')[1]);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });

    const previewUrl = URL.createObjectURL(file);
    const name = file.name || 'screenshot.png';
    setPasteHighlight(true);
    setTimeout(() => setPasteHighlight(false), 700);
    setUploadedImage({ base64, mimeType, previewUrl, name });
    setImageAnalysis(null);
    setImageDismissed(false);
    await analyzeImage({ base64, mimeType, name });
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (file) await processImageFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('dragging');
    const file = e.dataTransfer.files?.[0];
    if (file) processImageFile(file);
  };

  const handleDragOver  = (e) => { e.preventDefault(); e.currentTarget.classList.add('dragging'); };
  const handleDragLeave = (e) => { e.currentTarget.classList.remove('dragging'); };

  const analyzeImage = async (imageData) => {
    setImageAnalyzing(true);
    setError(null);
    const baseUrl = api.baseUrl || import.meta.env.VITE_API_URL || '';
    try {
      const res = await fetch(`${baseUrl}/api/ai/analyze-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({
          image: { base64: imageData.base64, mimeType: imageData.mimeType, name: imageData.name },
          conversationId: conversation?.id,
          storeIdentifier: conversation?.storeIdentifier,
        }),
      });
      if (!res.ok) { const text = await res.text(); throw new Error(`Vision ${res.status}: ${text.substring(0, 100)}`); }
      const data     = await res.json();
      const analysis = data.analysis || '';
      setImageAnalysis(analysis);
      // Always auto-generate when screenshot is uploaded
      const chatMsg = isEditedRef.current ? editedTextRef.current : getLastCustomerMessage()?.content;
const msgText = analysis.length > 80 ? analysis : chatMsg;
if (msgText) await fetchSuggestionsWithImage(msgText, imageData, analysis);
    } catch (err) {
      setError(`Image analysis failed: ${err.message}`);
    } finally {
      setImageAnalyzing(false);
    }
  };

  const fetchSuggestionsWithImage = async (messageText, imageData, imageAnalysisText) => {
    if (!messageText?.trim()) return;
    setReadyToGenerate(false);
    setLoading(true);
    setError(null);
    setSuggestions([]);
    const { chatHistory, agentStyleSamples, analysis, recentContext } = buildConversationContext();
    const payload = {
      clientMessage: messageText.trim(), chatHistory, agentStyleSamples, recentContext, analysis,
      conversationId: conversation?.id, customerName: conversation?.customerName,
      customerEmail: conversation?.customerEmail,
      storeName: conversation?.storeName || conversation?.storeIdentifier,
      storeIdentifier: conversation?.storeIdentifier,
      adminNote: adminNoteRef.current || '', messageEdited: isEditedRef.current,
      brainSettings: (() => { try { return JSON.parse(localStorage.getItem('brain_suggestion_settings') || '{}'); } catch { return {}; } })(),
      adminImage: { base64: imageData.base64, mimeType: imageData.mimeType, name: imageData.name },
      imageAnalysis: imageAnalysisText,
    };
    try {
      const baseUrl = api.baseUrl || import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${baseUrl}/api/ai/suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const text = await res.text(); throw new Error(`Server ${res.status}: ${text.substring(0, 100)}`); }
      const data = await res.json();
      setSuggestions(data.suggestions || []);
    } catch (err) {
      setError(`Could not generate suggestions: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveImage = () => {
    if (uploadedImage?.previewUrl) URL.revokeObjectURL(uploadedImage.previewUrl);
    setUploadedImage(null);
    setImageAnalysis(null);
    setImageDismissed(false);
    // Re-fetch without image only if suggestions already exist
    if (suggestions.length > 0) {
      const msgText = isEditedRef.current ? editedTextRef.current : getLastCustomerMessage()?.content;
      if (msgText) fetchSuggestions(msgText, adminNoteRef.current);
    }
  };

  // ── New message: mark ready, don't auto-fetch ──────────────────────────────
  useEffect(() => {
    const lastCustomerMsg = getLastCustomerMessage();
    if (!lastCustomerMsg) { setSuggestions([]); setContextLevel('none'); setReadyToGenerate(false); return; }

    const msgId = String(lastCustomerMsg.id);
    if (msgId === lastProcessedMsgId.current) return;

    const quality = assessContextQuality();
    setContextLevel(quality);
    if (quality === 'none') { setSuggestions([]); setReadyToGenerate(false); return; }

    lastProcessedMsgId.current = msgId;
    isEditedRef.current   = false;
    editedTextRef.current = '';
    adminNoteRef.current  = '';
    setEditedMessage('');
    setAdminNote('');
    setMessageWasEdited(false);
    setIsEditing(false);
    setSuggestions([]);
    setError(null);
    setReadyToGenerate(true);
  }, [messages]);

  useEffect(() => {
    return () => { if (uploadedImage?.previewUrl) URL.revokeObjectURL(uploadedImage.previewUrl); };
  }, []);

  // ── Core fetch ─────────────────────────────────────────────────────────────
  const fetchSuggestions = async (messageText, note) => {
    if (!messageText?.trim()) return;
    setReadyToGenerate(false);
    setLoading(true);
    setError(null);
    setSuggestions([]);
    try {
      const data = await postToAI(buildPayload(messageText, { adminNote: note || '' }));
      setSuggestions(data.suggestions || []);
    } catch (err) {
      setError(`Could not generate suggestions: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = () => {
    const text = isEditedRef.current ? editedTextRef.current : getLastCustomerMessage()?.content;
    if (text) fetchSuggestions(text, adminNoteRef.current);
  };

  // Generate without screenshot — explicitly excludes image from payload
  const handleGenerateWithoutScreenshot = () => {
    const text = isEditedRef.current ? editedTextRef.current : getLastCustomerMessage()?.content;
    if (!text) return;
    setImageDismissed(true);
    setReadyToGenerate(false);
    setLoading(true);
    setError(null);
    setSuggestions([]);
    const { chatHistory, agentStyleSamples, analysis, recentContext } = buildConversationContext();
    const payload = {
      clientMessage: text.trim(), chatHistory, agentStyleSamples, recentContext, analysis,
      conversationId: conversation?.id, customerName: conversation?.customerName,
      customerEmail: conversation?.customerEmail,
      storeName: conversation?.storeName || conversation?.storeIdentifier,
      storeIdentifier: conversation?.storeIdentifier,
      adminNote: adminNoteRef.current || '', messageEdited: isEditedRef.current,
      brainSettings: (() => { try { return JSON.parse(localStorage.getItem('brain_suggestion_settings') || '{}'); } catch { return {}; } })(),
      // no adminImage / imageAnalysis — intentionally excluded
    };
    const baseUrl = api.baseUrl || import.meta.env.VITE_API_URL || '';
    fetch(`${baseUrl}/api/ai/suggestions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify(payload),
    })
      .then(res => { if (!res.ok) throw new Error(`Server ${res.status}`); return res.json(); })
      .then(data => setSuggestions(data.suggestions || []))
      .catch(err => setError(`Could not generate suggestions: ${err.message}`))
      .finally(() => setLoading(false));
  };

  const handleOpenDetailed = async () => {
    if (!suggestions.length) return;
    setDetailedModal({ loading: true, error: null, answers: [] });
    setActiveTab(0);
    const lastCustomerMsg = getLastCustomerMessage();
    const clientMessage = isEditedRef.current ? editedTextRef.current : (lastCustomerMsg?.content || '');
    try {
      const data = await postToAI(buildPayload(clientMessage, { detailedAnswerMode: true, baseSuggestions: suggestions }));
      setDetailedModal({ loading: false, error: null, answers: data.detailedAnswers || [] });
    } catch (err) {
      setDetailedModal({ loading: false, error: `Failed to generate: ${err.message}`, answers: [] });
    }
  };

  const handleRefresh = () => {
    const text = isEditedRef.current ? editedTextRef.current : getLastCustomerMessage()?.content;
    if (text) fetchSuggestions(text, adminNoteRef.current);
  };

  const handleStartEdit = () => {
    const msg = getLastCustomerMessage();
    if (!msg) return;
    setEditedMessage(isEditedRef.current ? editedTextRef.current : (msg.content || ''));
    setIsEditing(true);
    setTimeout(() => editTextareaRef.current?.focus(), 50);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    if (!isEditedRef.current) { setEditedMessage(''); setAdminNote(''); }
  };

  const handleApplyEdit = () => {
    if (!editedMessage.trim()) return;
    isEditedRef.current   = true;
    editedTextRef.current = editedMessage.trim();
    adminNoteRef.current  = adminNote.trim();
    setIsEditing(false);
    setMessageWasEdited(true);
    fetchSuggestions(editedMessage.trim(), adminNote.trim());
  };

  const handleResetToOriginal = () => {
    const msg = getLastCustomerMessage();
    isEditedRef.current   = false;
    editedTextRef.current = '';
    adminNoteRef.current  = '';
    setIsEditing(false);
    setEditedMessage('');
    setMessageWasEdited(false);
    setAdminNote('');
    if (msg) fetchSuggestions(msg.content);
  };

  const lastCustomerMsg  = getLastCustomerMessage();
  const contextIndicator = getContextIndicator();
  const hasScreenshot    = uploadedImage && !imageDismissed;

  if (!conversation || !lastCustomerMsg) return null;

  return (
    <>
      <div className={`ai-suggestions-panel ${collapsed ? 'collapsed' : ''} ${pasteHighlight ? 'ai-paste-highlight' : ''}`}>

        <div className="ai-suggestions-header">
          <div className="ai-suggestions-title">
            <span className="ai-icon">✦</span>
            <span>AI Suggestions</span>
            {contextIndicator && (
              <span className="ai-context-indicator" style={{ color: contextIndicator.color }} title={contextIndicator.text} />
            )}
            {hasScreenshot && (
              <span className="ai-image-badge" title="Screenshot loaded">📎 screenshot</span>
            )}
          </div>
          <div className="ai-suggestions-actions">
            {suggestions.length > 0 && (
              <button
                className="ai-btn-icon"
                onClick={handleRefresh}
                disabled={loading || imageAnalyzing}
                title="Regenerate"
                type="button"
              >↻</button>
            )}
            <button
              className="ai-btn-icon"
              onClick={() => setCollapsed(c => !c)}
              title={collapsed ? 'Expand' : 'Collapse'}
              type="button"
            >{collapsed ? '◂' : '▸'}</button>
          </div>
        </div>

        {!collapsed && (
          <div className="ai-suggestions-body">

            {contextIndicator && contextLevel !== 'excellent' && (
              <div className="ai-context-notice" style={{ borderLeftColor: contextIndicator.color }}>
                <span className="ai-context-notice-text">{contextIndicator.text}</span>
              </div>
            )}

            {/* ── Screenshot upload ──────────────────────────────────────── */}
            <div className="ai-upload-row">
              <button
                className="ai-upload-btn"
                onClick={() => imageInputRef.current?.click()}
                disabled={imageAnalyzing || loading}
                type="button"
              >
                Upload Screenshot
              </button>
              <span className="ai-upload-hint-inline">
                or paste <kbd className="ai-kbd">Ctrl+V</kbd>
              </span>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                style={{ display: 'none' }}
                onChange={handleImageSelect}
              />
            </div>

            {!uploadedImage && !imageAnalyzing && (
              <div
                className="ai-image-upload-zone ai-image-upload-zone--subtle"
                onClick={() => imageInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && imageInputRef.current?.click()}
                title="Add a screenshot — or press Ctrl+V to paste"
              >
                <span className="ai-upload-icon">📎</span>
                <span className="ai-upload-text">Add screenshot to improve suggestions</span>
                <kbd className="ai-kbd ai-kbd--subtle">Ctrl+V</kbd>
              </div>
            )}

            {imageAnalyzing && (
              <div className="ai-image-analyzing">
                <div className="ai-loading-dots"><span /><span /><span /></div>
                <p>Analyzing screenshot…</p>
                <span className="ai-image-analyzing-sub">Generating suggestions with screenshot context</span>
              </div>
            )}

            {uploadedImage && !imageAnalyzing && !imageDismissed && (
              <div className="ai-image-preview-card">
                <div className="ai-image-preview-header">
                  <span className="ai-image-preview-label">📎 Context screenshot</span>
                  <div className="ai-image-preview-actions">
                    <button className="ai-image-preview-btn" onClick={() => setImageDismissed(true)} title="Hide preview" type="button">Hide</button>
                    <button className="ai-image-preview-btn ai-image-remove-btn" onClick={handleRemoveImage} title="Remove screenshot" type="button">✕ Remove</button>
                  </div>
                </div>
                <div className="ai-image-preview-body">
                  <img
                    src={uploadedImage.previewUrl}
                    alt="Context screenshot"
                    className="ai-image-thumb"
                    onClick={() => window.open(uploadedImage.previewUrl, '_blank')}
                    title="Click to open full size"
                  />
                  {imageAnalysis && (
                    <div className="ai-image-analysis-text">
                      <span className="ai-image-analysis-label">AI read:</span>
                      <p>{imageAnalysis}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {uploadedImage && imageDismissed && (
              <button className="ai-image-restore-btn" onClick={() => setImageDismissed(false)} type="button">
                🖼 Show context screenshot
              </button>
            )}

            {/* ── Generate button (no screenshot) or without-screenshot option ── */}
            {(readyToGenerate || (!loading && !imageAnalyzing && !suggestions.length && lastCustomerMsg)) && !loading && !imageAnalyzing && (
              <div className="ai-generate-row">
                {!hasScreenshot && (
                  <button
                    className="ai-generate-btn"
                    onClick={handleGenerate}
                    type="button"
                  >
                    ✦ Generate Suggestions
                  </button>
                )}
                {hasScreenshot && (
                  <button
                    className="ai-generate-btn ai-generate-btn--secondary"
                    onClick={handleGenerateWithoutScreenshot}
                    disabled={loading || imageAnalyzing}
                    type="button"
                  >
                    Generate without screenshot
                  </button>
                )}
              </div>
            )}

            {/* ── Edit UI ────────────────────────────────────────────────── */}
            {(isEditing || messageWasEdited) && (
              <div className="ai-context-section">
                {isEditing ? (
                  <div className="ai-edit-area">
                    <textarea
                      ref={editTextareaRef}
                      className="ai-edit-textarea"
                      value={editedMessage}
                      onChange={e => setEditedMessage(e.target.value)}
                      placeholder="Edit the customer's message..."
                      rows={3}
                    />
                    <textarea
                      className="ai-note-textarea"
                      value={adminNote}
                      onChange={e => setAdminNote(e.target.value)}
                      placeholder="Instructions for AI (optional): e.g. 'include refund policy', 'ask for order number'..."
                      rows={2}
                    />
                    <div className="ai-edit-actions">
                      <button className="ai-edit-cancel" onClick={handleCancelEdit} type="button">Cancel</button>
                      <button className="ai-edit-apply" onClick={handleApplyEdit} disabled={!editedMessage.trim()} type="button">
                        ✦ Re-generate
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="ai-edited-notice">
                    <span className="ai-edited-badge">edited</span>
                    <span className="ai-edited-text">
                      {editedMessage.length > 100 ? editedMessage.substring(0, 100) + '…' : editedMessage}
                    </span>
                    <button className="ai-reset-msg-btn" onClick={handleResetToOriginal} type="button">↩ Reset</button>
                  </div>
                )}
              </div>
            )}

            {!isEditing && !messageWasEdited && suggestions.length > 0 && (
              <div className="ai-edit-trigger-row">
                <button className="ai-edit-msg-btn" onClick={handleStartEdit} type="button">
                  ✎ Edit message / add instructions
                </button>
              </div>
            )}

            {/* ── Suggestions ───────────────────────────────────────────── */}
            <div className="ai-suggestions-list">
              {loading ? (
                <div className="ai-loading">
                  <div className="ai-loading-dots"><span /><span /><span /></div>
                  <p>Generating suggestions…</p>
                </div>
              ) : error && !suggestions.length ? (
                <div className="ai-error">
                  <p>{error}</p>
                  <button onClick={handleRefresh} type="button" className="ai-retry-btn">Try Again</button>
                </div>
              ) : suggestions.map((s, i) => (
                <button key={i} className="ai-suggestion-card" onClick={() => onSelectSuggestion(s)} type="button">
                  <span className="ai-suggestion-number">{i + 1}</span>
                  <span className="ai-suggestion-text">{s}</span>
                </button>
              ))}
            </div>

            {!loading && !imageAnalyzing && suggestions.length > 0 && (
              <button className="ai-detailed-trigger" onClick={handleOpenDetailed} type="button">
                <span className="ai-detailed-trigger-label">Show Longer Replies</span>
                <span className="ai-detailed-trigger-badge">3 styles</span>
              </button>
            )}

          </div>
        )}
      </div>

      {detailedModal && (
        <div className="ai-modal-overlay" onClick={() => setDetailedModal(null)}>
          <div className="ai-modal" onClick={e => e.stopPropagation()}>
            <div className="ai-modal-header">
              <div className="ai-modal-title">
                <span className="ai-icon">✦</span>
                <span>Detailed Replies</span>
                <span className="ai-modal-subtitle">
                  Based on your suggestions{hasScreenshot ? ' + screenshot' : ''}
                </span>
              </div>
              <button className="ai-modal-close" onClick={() => setDetailedModal(null)} type="button">✕</button>
            </div>

            {detailedModal.loading ? (
              <div className="ai-modal-loading">
                <div className="ai-loading-dots"><span /><span /><span /></div>
                <p>Expanding your replies…</p>
                <span className="ai-modal-loading-sub">Building detailed versions from brain data</span>
              </div>
            ) : detailedModal.error ? (
              <div className="ai-modal-error-body">
                <p>{detailedModal.error}</p>
                <button onClick={handleOpenDetailed} type="button" className="ai-retry-btn">Try Again</button>
              </div>
            ) : (
              <>
                <div className="ai-modal-tabs">
                  {[0, 1, 2].map(i => (
                    <button
                      key={i}
                      className={`ai-modal-tab ${activeTab === i ? 'active' : ''}`}
                      style={{ '--tab-color': TAB_COLORS[i]?.color }}
                      onClick={() => setActiveTab(i)}
                      title={suggestions[i] || `Reply ${i + 1}`}
                      type="button"
                    >
                      <span className="ai-modal-tab-label">Reply {i + 1}</span>
                    </button>
                  ))}
                </div>
                <div className="ai-modal-body">
                  {suggestions[activeTab] && (
                    <div className="ai-modal-base-suggestion">
                      <span className="ai-modal-base-label">Based on:</span>
                      <span className="ai-modal-base-text">{suggestions[activeTab]}</span>
                    </div>
                  )}
                  {detailedModal.answers[activeTab] ? (
                    <div className="ai-modal-answer-block" style={{ '--answer-color': TAB_COLORS[activeTab]?.color }}>
                      {detailedModal.answers[activeTab].text}
                    </div>
                  ) : (
                    <div className="ai-modal-answer-empty">No answer generated for this reply.</div>
                  )}
                </div>
                <div className="ai-modal-footer">
                  <button className="ai-modal-regenerate" onClick={handleOpenDetailed} type="button">↻ Regenerate All</button>
                  {detailedModal.answers[activeTab] && (
                    <button
                      className="ai-modal-use"
                      style={{ background: TAB_COLORS[activeTab]?.color }}
                      onClick={() => { onSelectSuggestion(detailedModal.answers[activeTab].text); setDetailedModal(null); }}
                      type="button"
                    >
                      Use This Reply
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default AISuggestions;