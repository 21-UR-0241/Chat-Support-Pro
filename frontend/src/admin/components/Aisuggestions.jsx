
// import React, { useState, useEffect, useRef } from 'react';
// import api from '../services/api';
// import '../styles/Aisuggestions.css';

// function AISuggestions({ conversation, messages, onSelectSuggestion }) {
//   const [suggestions, setSuggestions]           = useState([]);
//   const [needsReview, setNeedsReview]           = useState([]);
//   const [isFallback, setIsFallback]             = useState(false);
//   const [loading, setLoading]                   = useState(false);
//   const [error, setError]                       = useState(null);
//   const [collapsed, setCollapsed]               = useState(false);
//   const [contextLevel, setContextLevel]         = useState('none');
//   const [readyToGenerate, setReadyToGenerate]   = useState(false);
//   const lastProcessedMsgId                      = useRef(null);

//   const [isEditing, setIsEditing]               = useState(false);
//   const [editedMessage, setEditedMessage]       = useState('');
//   const [adminNote, setAdminNote]               = useState('');
//   const [messageWasEdited, setMessageWasEdited] = useState(false);
//   const editTextareaRef                         = useRef(null);

//   const [detailedModal, setDetailedModal]       = useState(null);
//   const [activeTab, setActiveTab]               = useState(0);

//   const [uploadedImage, setUploadedImage]       = useState(null);
//   const [imageAnalyzing, setImageAnalyzing]     = useState(false);
//   const [imageAnalysis, setImageAnalysis]       = useState(null);
//   const [imageDismissed, setImageDismissed]     = useState(false);
//   const [pasteHighlight, setPasteHighlight]     = useState(false);
//   const imageInputRef                           = useRef(null);

//   const isEditedRef    = useRef(false);
//   const editedTextRef  = useRef('');
//   const adminNoteRef   = useRef('');
//   const activeConvRef  = useRef(null);

//   const TAB_COLORS = [
//     { color: '#f59e0b' },
//     { color: '#3b82f6' },
//     { color: '#8b5cf6' },
//   ];

//   // Single source of truth for "was this response a canned template?"
//   const isFallbackResponse = (data) => data?.fallback === true || data?.source === 'fallback';

//   // ── Reset ALL state when conversation changes ──────────────────────────────
//   useEffect(() => {
//     if (!conversation?.id) return;
//     activeConvRef.current = conversation.id;
//     setLoading(false);
//     setImageAnalyzing(false);
//     setSuggestions([]);
//     setNeedsReview([]);
//     setIsFallback(false);
//     setError(null);
//     setContextLevel('none');
//     setReadyToGenerate(false);
//     setIsEditing(false);
//     setEditedMessage('');
//     setAdminNote('');
//     setMessageWasEdited(false);
//     setDetailedModal(null);
//     setActiveTab(0);
//     if (uploadedImage?.previewUrl) URL.revokeObjectURL(uploadedImage.previewUrl);
//     setUploadedImage(null);
//     setImageAnalysis(null);
//     setImageDismissed(false);
//     lastProcessedMsgId.current = null;
//     isEditedRef.current        = false;
//     editedTextRef.current      = '';
//     adminNoteRef.current       = '';
//   }, [conversation?.id]);

//   // ── Paste handler ──────────────────────────────────────────────────────────
//   useEffect(() => {
//     const handlePaste = (e) => {
//       const items = e.clipboardData?.items;
//       if (!items) return;
//       let imageItem = null;
//       for (const item of items) {
//         if (item.type.startsWith('image/')) { imageItem = item; break; }
//       }
//       if (!imageItem) return;
//       e.preventDefault();
//       e.stopPropagation();
//       const file = imageItem.getAsFile();
//       if (file) processImageFile(file);
//     };
//     window.addEventListener('paste', handlePaste, true);
//     return () => window.removeEventListener('paste', handlePaste, true);
//   }, [conversation, messages]);

//   // ── Helpers ────────────────────────────────────────────────────────────────
//   // Only ever returns a customer message that BELONGS to the conversation on
//   // screen. During a switch, a late inbound message for the previous
//   // conversation can still be in `messages` for a render — filtering by
//   // conversation id here prevents it from seeding suggestions.
//   const getLastCustomerMessage = () => {
//     if (!messages?.length) return null;
//     const activeId = conversation?.id;
//     for (let i = messages.length - 1; i >= 0; i--) {
//       const m = messages[i];
//       if (m.senderType !== 'customer' || m._optimistic) continue;
//       const mConv = m.conversationId ?? m.conversation_id;
//       if (mConv != null && String(mConv) !== String(activeId)) continue; // foreign → skip
//       return m;
//     }
//     return null;
//   };

//   const assessContextQuality = () => {
//     if (!messages?.length) return 'none';
//     const customers = messages.filter(m => m.senderType === 'customer' && !m._optimistic).length;
//     const agents    = messages.filter(m => m.senderType === 'agent'    && !m._optimistic).length;
//     if (customers === 0) return 'none';
//     if (customers === 1 && agents === 0) return 'minimal';
//     if (customers >= 1 && agents >= 1 && customers + agents < 4) return 'basic';
//     if (customers >= 2 && agents >= 2) return 'good';
//     if (customers >= 3 && agents >= 3) return 'excellent';
//     return 'basic';
//   };

//   const getContextIndicator = () => {
//     const map = {
//       minimal:   { text: 'First message — suggestions may be general', color: '#3b82f6' },
//       basic:     { text: 'Basic context — suggestions improving',       color: '#f59e0b' },
//       good:      { text: 'Good context — quality suggestions',          color: '#10b981' },
//       excellent: { text: 'Excellent context — high quality suggestions', color: '#059669' },
//     };
//     return map[contextLevel] || null;
//   };

//   const buildConversationContext = () => {
//     if (!messages?.length) return { chatHistory: '', analysis: {}, recentContext: null };

//     const customerMessages = messages.filter(m => m.senderType === 'customer');
//     const agentMessages    = messages.filter(m => m.senderType === 'agent');
//     const allCustomerText  = customerMessages.map(m => (m.content || '').toLowerCase()).join(' ');
//     const lastCustomerText = customerMessages.at(-1)?.content || '';

//     const lastCustomerMessages = customerMessages.filter(m => !m._optimistic).slice(-2);
//     const lastAgentMessages    = agentMessages.filter(m => !m._optimistic).slice(-2);

//     const chatHistory = messages.slice(-40).map(m => {
//       const role    = m.senderType === 'customer' ? 'Customer' : 'Agent';
//       const content = m.content || (m.fileData ? `[File: ${m.fileData?.name || 'attachment'}]` : '');
//       return `${role}: ${content}`;
//     }).join('\n');

//     const agentStyleSamples = agentMessages
//       .filter(m => !m._optimistic && m.content && m.content.trim().length > 8)
//       .slice(-15)
//       .map(m => m.content.trim());

//     const orderNumberMatch = allCustomerText.match(/(?:order|#)\s*#?\s*(\d{4,})/i)
//       || allCustomerText.match(/#(\d{4,})/)
//       || allCustomerText.match(/\b(\d{5,})\b/);
//     const orderNumber   = orderNumberMatch?.[1] || null;
//     const emailMatch    = allCustomerText.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
//     const customerEmail = emailMatch?.[0] || null;

//     const detectedIssue = (
//       /broken|damaged|defective|cracked|shattered|crushed/i.test(allCustomerText)                                         ? 'damaged'    :
//       /wrong item|incorrect|not what i ordered|different|ordered.{0,40}received|sent.{0,30}instead/i.test(allCustomerText) ? 'wrong_item' :
//       /missing|didn't receive|never arrived|lost/i.test(allCustomerText)                                                   ? 'missing'    :
//       /late|delayed|taking too long|still waiting/i.test(allCustomerText)                                                  ? 'late'       :
//       /poor quality|cheap|not as described|disappointed with quality/i.test(allCustomerText)                               ? 'quality'    :
//       null
//     );

//     const customerWants = {
//       refund:      /refund|money back/i.test(allCustomerText),
//       replacement: /replacement|replace|send another|new one/i.test(allCustomerText),
//       tracking:    /tracking|where is|status|when will/i.test(allCustomerText),
//       help:        /help|assist|support/i.test(allCustomerText),
//     };

//     const topicKeywords = {
//       order_status:    ['order', 'tracking', 'shipped', 'delivery', 'deliver', 'where is', 'status', 'when will'],
//       refund_return:   ['refund', 'return', 'money back', 'cancel', 'cancellation', 'exchange'],
//       product_issue:   ['broken', 'damaged', 'defective', 'wrong item', 'missing', 'not working', "doesn't work", 'issue with', 'ordered', 'received wrong', 'sent wrong'],
//       payment:         ['payment', 'charged', 'charge', 'billing', 'invoice', 'receipt', 'credit card', 'declined'],
//       discount_promo:  ['discount', 'coupon', 'promo', 'code', 'sale', 'offer', 'deal'],
//       product_inquiry: ['product', 'item', 'size', 'color', 'stock', 'available', 'price', 'how much'],
//       shipping:        ['shipping', 'ship', 'freight', 'express', 'standard', 'free shipping', 'shipping cost'],
//       account:         ['account', 'login', 'password', 'sign in', 'email', 'profile', 'update my'],
//       complaint:       ['complaint', 'unacceptable', 'terrible', 'worst', 'angry', 'frustrated', 'disappointed', 'horrible', 'scam'],
//       gratitude:       ['thank', 'thanks', 'appreciate', 'helpful', 'great', 'awesome', 'perfect', 'solved'],
//       greeting:        ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening'],
//     };

//     const currentMsgLower = lastCustomerText.toLowerCase();
//     const detectedTopics = Object.entries(topicKeywords)
//       .filter(([topic, kws]) => {
//         if (kws.some(kw => currentMsgLower.includes(kw))) return true;
//         const statefulTopics = ['order_status', 'shipping', 'refund_return', 'product_issue'];
//         return statefulTopics.includes(topic) && kws.some(kw => allCustomerText.includes(kw));
//       })
//       .map(([topic]) => topic);

//     const availableCustomerText = lastCustomerMessages.map(m => (m.content || '').toLowerCase()).join(' ');
//     const negCount = ['angry','frustrated','upset','terrible','horrible','worst','unacceptable','disappointed','annoyed','furious','scam','ridiculous','disgusting','pathetic','useless']
//       .filter(w => availableCustomerText.includes(w)).length;
//     const posCount = ['thank','thanks','great','awesome','perfect','helpful','appreciate','amazing','wonderful','love','excellent','solved','happy']
//       .filter(w => availableCustomerText.includes(w)).length;
//     const isUrgent = ['urgent','asap','immediately','emergency','right now','please hurry','critical','time sensitive']
//       .some(w => availableCustomerText.includes(w));

//     const sentiment = negCount >= 2 ? 'very_negative' : negCount >= 1 ? 'negative' :
//                       posCount >= 2 ? 'very_positive'  : posCount >= 1 ? 'positive' : 'neutral';

//     const isQuestion = lastCustomerMessages.some(m => {
//       const t = (m.content || '').toLowerCase();
//       return t.includes('?') || /^(can |could |how |what |where |when |why |is |are |do |does |will |would |who |which |have )/.test(t.trim());
//     });

//     const isRepeat = customerMessages.length >= 2 &&
//       customerMessages.slice(-3).some(m => {
//         const t = (m.content || '').toLowerCase();
//         return ['again','already told','i said','still','follow up','any update'].some(w => t.includes(w));
//       });

//     const wordCount       = lastCustomerText.split(/\s+/).filter(Boolean).length;
//     const messageRichness = wordCount >= 30 ? 'very_detailed' : wordCount >= 15 ? 'detailed' : wordCount >= 5 ? 'brief' : 'very_brief';

//     const allAgentText       = agentMessages.map(m => (m.content || '').toLowerCase()).join(' ');
//     const availableAgentText = lastAgentMessages.map(m => (m.content || '').toLowerCase()).join(' ');

//     return {
//       chatHistory,
//       agentStyleSamples,
//       recentContext: {
//         lastCustomerMessages: lastCustomerMessages.map(m => m.content || '[attachment]'),
//         lastAgentMessages:    lastAgentMessages.map(m => m.content || ''),
//         contextQuality: assessContextQuality(),
//         messageRichness, detectedIssue, customerWants,
//       },
//       analysis: {
//         detectedTopics, sentiment, isUrgent, isQuestion, isRepeat,
//         hasOrderNumber: !!orderNumber, orderNumber,
//         hasEmail: !!customerEmail, customerEmail,
//         hasAttachment: customerMessages.some(m => m.fileData || m.fileUrl),
//         turnCount: messages.length,
//         isLongConversation: messages.length > 10,
//         lastAgentText: agentMessages.at(-1)?.content || '',
//         agentAskedForOrder:      allAgentText.includes('order number') || allAgentText.includes('order #'),
//         agentAlreadyApologized:  availableAgentText.includes('sorry') || availableAgentText.includes('apologize'),
//         agentAskedForEmail:      allAgentText.includes('email address') || allAgentText.includes('your email'),
//         agentAskedForPhoto:      allAgentText.includes('photo') || allAgentText.includes('picture') || allAgentText.includes('screenshot'),
//         agentOfferedRefund:      availableAgentText.includes('refund') || availableAgentText.includes('money back'),
//         agentOfferedReplacement: availableAgentText.includes('replacement') || availableAgentText.includes('replace'),
//         customerMessageCount: customerMessages.length,
//         agentMessageCount:    agentMessages.length,
//         messageRichness, detectedIssue, customerWants,
//       },
//     };
//   };

//   const buildPayload = (clientMessage, extra = {}) => {
//     const { chatHistory, agentStyleSamples, analysis, recentContext } = buildConversationContext();
//     return {
//       clientMessage: clientMessage.trim(),
//       chatHistory, agentStyleSamples, recentContext, analysis,
//       conversationId:  conversation?.id,
//       customerName:    conversation?.customerName,
//       customerEmail:   conversation?.customerEmail,
//       storeName:       conversation?.storeName || conversation?.storeIdentifier,
//       storeIdentifier: conversation?.storeIdentifier,
//       adminNote:       adminNoteRef.current || '',
//       messageEdited:   isEditedRef.current,
//       brainSettings:   (() => { try { return JSON.parse(localStorage.getItem('brain_suggestion_settings') || '{}'); } catch { return {}; } })(),
//       ...(uploadedImage && !imageDismissed ? {
//         adminImage: { base64: uploadedImage.base64, mimeType: uploadedImage.mimeType, name: uploadedImage.name },
//         imageAnalysis: imageAnalysis || null,
//       } : {}),
//       ...extra,
//     };
//   };

//   const postToAI = async (payload) => {
//     const baseUrl = api.baseUrl || import.meta.env.VITE_API_URL || '';
//     const res = await fetch(`${baseUrl}/api/ai/suggestions`, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
//       body: JSON.stringify(payload),
//     });
//     if (!res.ok) { const text = await res.text(); throw new Error(`Server ${res.status}: ${text.substring(0, 100)}`); }
//     return res.json();
//   };

//   // ── Image handling ─────────────────────────────────────────────────────────
//   const processImageFile = async (file) => {
//     const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
//     const mimeType = ALLOWED.includes(file.type) ? file.type : 'image/png';
//     if (!ALLOWED.includes(mimeType)) { setError('Unsupported image type. Use JPG, PNG, or WebP.'); return; }
//     if (file.size > 5 * 1024 * 1024) { setError('Image must be under 5 MB.'); return; }

//     const base64 = await new Promise((resolve, reject) => {
//       const reader = new FileReader();
//       reader.onload  = () => resolve(reader.result.split(',')[1]);
//       reader.onerror = () => reject(new Error('Failed to read file'));
//       reader.readAsDataURL(file);
//     });

//     const previewUrl = URL.createObjectURL(file);
//     const name = file.name || 'screenshot.png';
//     setPasteHighlight(true);
//     setTimeout(() => setPasteHighlight(false), 700);
//     setUploadedImage({ base64, mimeType, previewUrl, name });
//     setImageAnalysis(null);
//     setImageDismissed(false);
//     await analyzeImage({ base64, mimeType, name });
//     if (imageInputRef.current) imageInputRef.current.value = '';
//   };

//   const handleImageSelect = async (e) => {
//     const file = e.target.files?.[0];
//     if (file) await processImageFile(file);
//   };

//   const handleDrop = (e) => {
//     e.preventDefault();
//     e.currentTarget.classList.remove('dragging');
//     const file = e.dataTransfer.files?.[0];
//     if (file) processImageFile(file);
//   };

//   const handleDragOver  = (e) => { e.preventDefault(); e.currentTarget.classList.add('dragging'); };
//   const handleDragLeave = (e) => { e.currentTarget.classList.remove('dragging'); };

//   const analyzeImage = async (imageData) => {
//     const reqConv = conversation?.id;
//     setImageAnalyzing(true);
//     setError(null);
//     const baseUrl = api.baseUrl || import.meta.env.VITE_API_URL || '';
//     try {
//       const res = await fetch(`${baseUrl}/api/ai/analyze-image`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
//         body: JSON.stringify({
//           image: { base64: imageData.base64, mimeType: imageData.mimeType, name: imageData.name },
//           conversationId: conversation?.id,
//           storeIdentifier: conversation?.storeIdentifier,
//         }),
//       });
//       if (!res.ok) { const text = await res.text(); throw new Error(`Vision ${res.status}: ${text.substring(0, 100)}`); }
//       const data = await res.json();
//       if (reqConv !== activeConvRef.current) return;   // switched during vision call — bail
//       const analysis = data.analysis || '';
//       setImageAnalysis(analysis);
//       const chatMsg = isEditedRef.current ? editedTextRef.current : getLastCustomerMessage()?.content;
//       const msgText = chatMsg?.trim()
//         ? chatMsg
//         : '[Screenshot uploaded by agent — no customer message yet. Base your reply on the screenshot data.]';

//       await fetchSuggestionsWithImage(msgText, imageData, analysis);
//     } catch (err) {
//       if (reqConv !== activeConvRef.current) return;
//       setError(`Image analysis failed: ${err.message}`);
//     } finally {
//       if (reqConv === activeConvRef.current) setImageAnalyzing(false);
//     }
//   };

//   const fetchSuggestionsWithImage = async (messageText, imageData, imageAnalysisText) => {
//     if (!messageText?.trim()) return;
//     const reqConv = conversation?.id;
//     setReadyToGenerate(false);
//     setLoading(true);
//     setError(null);
//     setSuggestions([]);
//     setIsFallback(false);
//     const { chatHistory, agentStyleSamples, analysis, recentContext } = buildConversationContext();
//     const payload = {
//       clientMessage: messageText.trim(), chatHistory, agentStyleSamples, recentContext, analysis,
//       conversationId: conversation?.id, customerName: conversation?.customerName,
//       customerEmail: conversation?.customerEmail,
//       storeName: conversation?.storeName || conversation?.storeIdentifier,
//       storeIdentifier: conversation?.storeIdentifier,
//       adminNote: adminNoteRef.current || '', messageEdited: isEditedRef.current,
//       brainSettings: (() => { try { return JSON.parse(localStorage.getItem('brain_suggestion_settings') || '{}'); } catch { return {}; } })(),
//       adminImage: { base64: imageData.base64, mimeType: imageData.mimeType, name: imageData.name },
//       imageAnalysis: imageAnalysisText,
//     };
//     try {
//       const baseUrl = api.baseUrl || import.meta.env.VITE_API_URL || '';
//       const res = await fetch(`${baseUrl}/api/ai/suggestions`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
//         body: JSON.stringify(payload),
//       });
//       if (!res.ok) { const text = await res.text(); throw new Error(`Server ${res.status}: ${text.substring(0, 100)}`); }
//       const data = await res.json();
//       if (reqConv !== activeConvRef.current) return;   // switched mid-request — bail
//       setSuggestions(data.suggestions || []);
//       setNeedsReview(data.needsReview || []);
//       setIsFallback(isFallbackResponse(data));
//     } catch (err) {
//       if (reqConv !== activeConvRef.current) return;
//       setError(`Could not generate suggestions: ${err.message}`);
//     } finally {
//       if (reqConv === activeConvRef.current) setLoading(false);
//     }
//   };

//   const handleRemoveImage = () => {
//     if (uploadedImage?.previewUrl) URL.revokeObjectURL(uploadedImage.previewUrl);
//     setUploadedImage(null);
//     setImageAnalysis(null);
//     setImageDismissed(false);
//     // Re-fetch without image only if suggestions already exist
//     if (suggestions.length > 0) {
//       const msgText = isEditedRef.current ? editedTextRef.current : getLastCustomerMessage()?.content;
//       if (msgText) fetchSuggestions(msgText, adminNoteRef.current);
//     }
//   };

//   // ── New message: mark ready, don't auto-fetch ──────────────────────────────
//   // Gated on conversation identity so a late inbound message for a DIFFERENT
//   // conversation (arriving in the same render window as a switch) can never
//   // flip this panel to "ready" or seed suggestions from a foreign message.
//   useEffect(() => {
//     const lastCustomerMsg = getLastCustomerMessage();
//     if (!lastCustomerMsg) { setSuggestions([]); setIsFallback(false); setContextLevel('none'); setReadyToGenerate(false); return; }

//     // Guard: only react to messages belonging to the conversation on screen.
//     const msgConvId = lastCustomerMsg.conversationId ?? lastCustomerMsg.conversation_id;
//     if (msgConvId != null && String(msgConvId) !== String(conversation?.id)) return;

//     const msgId = String(lastCustomerMsg.id);
//     if (msgId === lastProcessedMsgId.current) return;

//     const quality = assessContextQuality();
//     setContextLevel(quality);
//     if (quality === 'none') { setSuggestions([]); setIsFallback(false); setReadyToGenerate(false); return; }

//     lastProcessedMsgId.current = msgId;
//     isEditedRef.current   = false;
//     editedTextRef.current = '';
//     adminNoteRef.current  = '';
//     setEditedMessage('');
//     setAdminNote('');
//     setMessageWasEdited(false);
//     setIsEditing(false);
//     setSuggestions([]);
//     setIsFallback(false);
//     setError(null);
//     setReadyToGenerate(true);
//   }, [messages, conversation?.id]);

//   useEffect(() => {
//     return () => { if (uploadedImage?.previewUrl) URL.revokeObjectURL(uploadedImage.previewUrl); };
//   }, []);

//   // ── Core fetch ─────────────────────────────────────────────────────────────
//   const fetchSuggestions = async (messageText, note) => {
//     if (!messageText?.trim()) return;
//     const reqConv = conversation?.id;
//     setReadyToGenerate(false);
//     setLoading(true);
//     setError(null);
//     setSuggestions([]);
//     setIsFallback(false);
//     try {
//       const data = await postToAI(buildPayload(messageText, { adminNote: note || '' }));
//       if (reqConv !== activeConvRef.current) return;   // switched mid-request — bail
//       setSuggestions(data.suggestions || []);
//       setNeedsReview(data.needsReview || []);
//       setIsFallback(isFallbackResponse(data));
//     } catch (err) {
//       if (reqConv !== activeConvRef.current) return;
//       setError(`Could not generate suggestions: ${err.message}`);
//     } finally {
//       if (reqConv === activeConvRef.current) setLoading(false);
//     }
//   };

//   const handleGenerate = () => {
//     const text = isEditedRef.current ? editedTextRef.current : getLastCustomerMessage()?.content;
//     if (text) fetchSuggestions(text, adminNoteRef.current);
//   };

//   // Generate without screenshot — explicitly excludes image from payload
//   const handleGenerateWithoutScreenshot = () => {
//     const text = isEditedRef.current ? editedTextRef.current : getLastCustomerMessage()?.content;
//     if (!text) return;
//     const reqConv = conversation?.id;
//     setImageDismissed(true);
//     setReadyToGenerate(false);
//     setLoading(true);
//     setError(null);
//     setSuggestions([]);
//     setIsFallback(false);
//     const { chatHistory, agentStyleSamples, analysis, recentContext } = buildConversationContext();
//     const payload = {
//       clientMessage: text.trim(), chatHistory, agentStyleSamples, recentContext, analysis,
//       conversationId: conversation?.id, customerName: conversation?.customerName,
//       customerEmail: conversation?.customerEmail,
//       storeName: conversation?.storeName || conversation?.storeIdentifier,
//       storeIdentifier: conversation?.storeIdentifier,
//       adminNote: adminNoteRef.current || '', messageEdited: isEditedRef.current,
//       brainSettings: (() => { try { return JSON.parse(localStorage.getItem('brain_suggestion_settings') || '{}'); } catch { return {}; } })(),
//       // no adminImage / imageAnalysis — intentionally excluded
//     };
//     const baseUrl = api.baseUrl || import.meta.env.VITE_API_URL || '';
//     fetch(`${baseUrl}/api/ai/suggestions`, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
//       body: JSON.stringify(payload),
//     })
//       .then(res => { if (!res.ok) throw new Error(`Server ${res.status}`); return res.json(); })
//       .then(data => {
//         if (reqConv !== activeConvRef.current) return;   // switched mid-request — bail
//         setSuggestions(data.suggestions || []);
//         setIsFallback(isFallbackResponse(data));
//       })
//       .catch(err => { if (reqConv === activeConvRef.current) setError(`Could not generate suggestions: ${err.message}`); })
//       .finally(() => { if (reqConv === activeConvRef.current) setLoading(false); });
//   };

//   const handleOpenDetailed = async () => {
//     if (!suggestions.length) return;
//     const reqConv = conversation?.id;
//     setDetailedModal({ loading: true, error: null, answers: [], fallback: false });
//     setActiveTab(0);
//     const lastCustomerMsg = getLastCustomerMessage();
//     const clientMessage = isEditedRef.current ? editedTextRef.current : (lastCustomerMsg?.content || '');
//     try {
//       const data = await postToAI(buildPayload(clientMessage, { detailedAnswerMode: true, baseSuggestions: suggestions }));
//       if (reqConv !== activeConvRef.current) return;   // switched mid-request — bail
//       setDetailedModal({ loading: false, error: null, answers: data.detailedAnswers || [], fallback: isFallbackResponse(data) });
//     } catch (err) {
//       if (reqConv !== activeConvRef.current) return;
//       setDetailedModal({ loading: false, error: `Failed to generate: ${err.message}`, answers: [], fallback: false });
//     }
//   };

//   const handleRefresh = () => {
//     const text = isEditedRef.current ? editedTextRef.current : getLastCustomerMessage()?.content;
//     if (text) fetchSuggestions(text, adminNoteRef.current);
//   };

//   const handleStartEdit = () => {
//     const msg = getLastCustomerMessage();
//     if (!msg) return;
//     setEditedMessage(isEditedRef.current ? editedTextRef.current : (msg.content || ''));
//     setIsEditing(true);
//     setTimeout(() => editTextareaRef.current?.focus(), 50);
//   };

//   const handleCancelEdit = () => {
//     setIsEditing(false);
//     if (!isEditedRef.current) { setEditedMessage(''); setAdminNote(''); }
//   };

//   const handleApplyEdit = () => {
//     if (!editedMessage.trim()) return;
//     isEditedRef.current   = true;
//     editedTextRef.current = editedMessage.trim();
//     adminNoteRef.current  = adminNote.trim();
//     setIsEditing(false);
//     setMessageWasEdited(true);
//     fetchSuggestions(editedMessage.trim(), adminNote.trim());
//   };

//   const handleResetToOriginal = () => {
//     const msg = getLastCustomerMessage();
//     isEditedRef.current   = false;
//     editedTextRef.current = '';
//     adminNoteRef.current  = '';
//     setIsEditing(false);
//     setEditedMessage('');
//     setMessageWasEdited(false);
//     setAdminNote('');
//     if (msg) fetchSuggestions(msg.content);
//   };

//   const lastCustomerMsg  = getLastCustomerMessage();
//   const contextIndicator = getContextIndicator();
//   const hasScreenshot    = uploadedImage && !imageDismissed;

//   if (!conversation || !lastCustomerMsg) return null;

//   return (
//     <>
//       <div className={`ai-suggestions-panel ${collapsed ? 'collapsed' : ''} ${pasteHighlight ? 'ai-paste-highlight' : ''}`}>

//         <div className="ai-suggestions-header">
//           <div className="ai-suggestions-title">
//             <span className="ai-icon">✦</span>
//             <span>AI Suggestions</span>
//             {contextIndicator && (
//               <span className="ai-context-indicator" style={{ color: contextIndicator.color }} title={contextIndicator.text} />
//             )}
//             {hasScreenshot && (
//               <span className="ai-image-badge" title="Screenshot loaded">📎 screenshot</span>
//             )}
//           </div>
//           <div className="ai-suggestions-actions">
//             {suggestions.length > 0 && (
//               <button
//                 className="ai-btn-icon"
//                 onClick={handleRefresh}
//                 disabled={loading || imageAnalyzing}
//                 title="Regenerate"
//                 type="button"
//               >↻</button>
//             )}
//             <button
//               className="ai-btn-icon"
//               onClick={() => setCollapsed(c => !c)}
//               title={collapsed ? 'Expand' : 'Collapse'}
//               type="button"
//             >{collapsed ? '◂' : '▸'}</button>
//           </div>
//         </div>

//         {!collapsed && (
//           <div className="ai-suggestions-body">

//             {contextIndicator && contextLevel !== 'excellent' && (
//               <div className="ai-context-notice" style={{ borderLeftColor: contextIndicator.color }}>
//                 <span className="ai-context-notice-text">{contextIndicator.text}</span>
//               </div>
//             )}

//             {/* ── Screenshot upload ──────────────────────────────────────── */}
//             <div className="ai-upload-row">
//               <button
//                 className="ai-upload-btn"
//                 onClick={() => imageInputRef.current?.click()}
//                 disabled={imageAnalyzing || loading}
//                 type="button"
//               >
//                 Upload Screenshot
//               </button>
//               <span className="ai-upload-hint-inline">
//                 or paste <kbd className="ai-kbd">Ctrl+V</kbd>
//               </span>
//               <input
//                 ref={imageInputRef}
//                 type="file"
//                 accept="image/jpeg,image/png,image/gif,image/webp"
//                 style={{ display: 'none' }}
//                 onChange={handleImageSelect}
//               />
//             </div>

//             {!uploadedImage && !imageAnalyzing && (
//               <div
//                 className="ai-image-upload-zone ai-image-upload-zone--subtle"
//                 onClick={() => imageInputRef.current?.click()}
//                 onDragOver={handleDragOver}
//                 onDragLeave={handleDragLeave}
//                 onDrop={handleDrop}
//                 role="button"
//                 tabIndex={0}
//                 onKeyDown={e => e.key === 'Enter' && imageInputRef.current?.click()}
//                 title="Add a screenshot — or press Ctrl+V to paste"
//               >
//                 <span className="ai-upload-icon">📎</span>
//                 <span className="ai-upload-text">Add screenshot to improve suggestions</span>
//                 <kbd className="ai-kbd ai-kbd--subtle">Ctrl+V</kbd>
//               </div>
//             )}

//             {imageAnalyzing && (
//               <div className="ai-image-analyzing">
//                 <div className="ai-loading-dots"><span /><span /><span /></div>
//                 <p>Analyzing screenshot…</p>
//                 <span className="ai-image-analyzing-sub">Generating suggestions with screenshot context</span>
//               </div>
//             )}

//             {uploadedImage && !imageAnalyzing && !imageDismissed && (
//               <div className="ai-image-preview-card">
//                 <div className="ai-image-preview-header">
//                   <span className="ai-image-preview-label">📎 Context screenshot</span>
//                   <div className="ai-image-preview-actions">
//                     <button className="ai-image-preview-btn" onClick={() => setImageDismissed(true)} title="Hide preview" type="button">Hide</button>
//                     <button className="ai-image-preview-btn ai-image-remove-btn" onClick={handleRemoveImage} title="Remove screenshot" type="button">✕ Remove</button>
//                   </div>
//                 </div>
//                 <div className="ai-image-preview-body">
//                   <img
//                     src={uploadedImage.previewUrl}
//                     alt="Context screenshot"
//                     className="ai-image-thumb"
//                     onClick={() => window.open(uploadedImage.previewUrl, '_blank')}
//                     title="Click to open full size"
//                   />
//                   {imageAnalysis && (
//                     <div className="ai-image-analysis-text">
//                       <span className="ai-image-analysis-label">AI read:</span>
//                       <p>{imageAnalysis}</p>
//                     </div>
//                   )}
//                 </div>
//               </div>
//             )}

//             {uploadedImage && imageDismissed && (
//               <button className="ai-image-restore-btn" onClick={() => setImageDismissed(false)} type="button">
//                 🖼 Show context screenshot
//               </button>
//             )}

//             {/* ── Generate button (no screenshot) or without-screenshot option ── */}
//             {(readyToGenerate || (!loading && !imageAnalyzing && !suggestions.length && lastCustomerMsg)) && !loading && !imageAnalyzing && (
//               <div className="ai-generate-row">
//                 {!hasScreenshot && (
//                   <button
//                     className="ai-generate-btn"
//                     onClick={handleGenerate}
//                     type="button"
//                   >
//                     ✦ Generate Suggestions
//                   </button>
//                 )}
//                 {hasScreenshot && (
//                   <button
//                     className="ai-generate-btn ai-generate-btn--secondary"
//                     onClick={handleGenerateWithoutScreenshot}
//                     disabled={loading || imageAnalyzing}
//                     type="button"
//                   >
//                     Generate without screenshot
//                   </button>
//                 )}
//               </div>
//             )}

//             {/* ── Edit UI ────────────────────────────────────────────────── */}
//             {(isEditing || messageWasEdited) && (
//               <div className="ai-context-section">
//                 {isEditing ? (
//                   <div className="ai-edit-area">
//                     <textarea
//                       ref={editTextareaRef}
//                       className="ai-edit-textarea"
//                       value={editedMessage}
//                       onChange={e => setEditedMessage(e.target.value)}
//                       placeholder="Edit the customer's message..."
//                       rows={3}
//                     />
//                     <textarea
//                       className="ai-note-textarea"
//                       value={adminNote}
//                       onChange={e => setAdminNote(e.target.value)}
//                       placeholder="Instructions for AI (optional): e.g. 'include refund policy', 'ask for order number'..."
//                       rows={2}
//                     />
//                     <div className="ai-edit-actions">
//                       <button className="ai-edit-cancel" onClick={handleCancelEdit} type="button">Cancel</button>
//                       <button className="ai-edit-apply" onClick={handleApplyEdit} disabled={!editedMessage.trim()} type="button">
//                         ✦ Re-generate
//                       </button>
//                     </div>
//                   </div>
//                 ) : (
//                   <div className="ai-edited-notice">
//                     <span className="ai-edited-badge">edited</span>
//                     <span className="ai-edited-text">
//                       {editedMessage.length > 100 ? editedMessage.substring(0, 100) + '…' : editedMessage}
//                     </span>
//                     <button className="ai-reset-msg-btn" onClick={handleResetToOriginal} type="button">↩ Reset</button>
//                   </div>
//                 )}
//               </div>
//             )}

//             {!isEditing && !messageWasEdited && suggestions.length > 0 && (
//               <div className="ai-edit-trigger-row">
//                 <button className="ai-edit-msg-btn" onClick={handleStartEdit} type="button">
//                   ✎ Edit message / add instructions
//                 </button>
//               </div>
//             )}

//             {/* ── Fallback notice — AI unavailable, canned templates shown ── */}
//             {isFallback && suggestions.length > 0 && !loading && (
//               <div className="ai-fallback-notice" role="alert" title="AI was unavailable — these are canned templates. Review before sending.">
//                 <span className="ai-fallback-notice-icon">⚠</span>
//                 <span className="ai-fallback-notice-text">Template replies (AI unavailable) — review before sending</span>
//               </div>
//             )}

//             {/* ── Suggestions ───────────────────────────────────────────── */}
//             <div className="ai-suggestions-list">
//               {loading ? (
//                 <div className="ai-loading">
//                   <div className="ai-loading-dots"><span /><span /><span /></div>
//                   <p>Generating suggestions…</p>
//                 </div>
//               ) : error && !suggestions.length ? (
//                 <div className="ai-error">
//                   <p>{error}</p>
//                   <button onClick={handleRefresh} type="button" className="ai-retry-btn">Try Again</button>
//                 </div>
//               ) : suggestions.map((s, i) => (
//                 <button
//                   key={i}
//                   className={`ai-suggestion-card ${isFallback ? 'ai-suggestion-card--fallback' : ''}`}
//                   onClick={() => onSelectSuggestion(s)}
//                   type="button"
//                 >
//                   <span className="ai-suggestion-number">{i + 1}</span>
//                   <span className="ai-suggestion-text">{s}</span>
//                   {isFallback && <span className="ai-suggestion-fallback-tag" title="Canned template">template</span>}
//                 </button>
//               ))}
//             </div>


//             {!loading && !imageAnalyzing && suggestions.length > 0 && (
//               <button className="ai-detailed-trigger" onClick={handleOpenDetailed} type="button">
//                 <span className="ai-detailed-trigger-label">Show Longer Replies</span>
//                 <span className="ai-detailed-trigger-badge">3 styles</span>
//               </button>
//             )}

//           </div>
//         )}
//       </div>

//       {detailedModal && (
//         <div className="ai-modal-overlay" onClick={() => setDetailedModal(null)}>
//           <div className="ai-modal" onClick={e => e.stopPropagation()}>
//             <div className="ai-modal-header">
//               <div className="ai-modal-title">
//                 <span className="ai-icon">✦</span>
//                 <span>Detailed Replies</span>
//                 <span className="ai-modal-subtitle">
//                   Based on your suggestions{hasScreenshot ? ' + screenshot' : ''}
//                 </span>
//               </div>
//               <button className="ai-modal-close" onClick={() => setDetailedModal(null)} type="button">✕</button>
//             </div>

//             {detailedModal.loading ? (
//               <div className="ai-modal-loading">
//                 <div className="ai-loading-dots"><span /><span /><span /></div>
//                 <p>Expanding your replies…</p>
//                 <span className="ai-modal-loading-sub">Building detailed versions from brain data</span>
//               </div>
//             ) : detailedModal.error ? (
//               <div className="ai-modal-error-body">
//                 <p>{detailedModal.error}</p>
//                 <button onClick={handleOpenDetailed} type="button" className="ai-retry-btn">Try Again</button>
//               </div>
//             ) : (
//               <>
//                 {detailedModal.fallback && (
//                   <div className="ai-fallback-notice ai-fallback-notice--modal" role="alert" title="AI was unavailable — these are canned templates. Review before sending.">
//                     <span className="ai-fallback-notice-icon">⚠</span>
//                     <span className="ai-fallback-notice-text">Template replies (AI unavailable) — review before sending</span>
//                   </div>
//                 )}
//                 <div className="ai-modal-tabs">
//                   {[0, 1, 2].map(i => (
//                     <button
//                       key={i}
//                       className={`ai-modal-tab ${activeTab === i ? 'active' : ''}`}
//                       style={{ '--tab-color': TAB_COLORS[i]?.color }}
//                       onClick={() => setActiveTab(i)}
//                       title={suggestions[i] || `Reply ${i + 1}`}
//                       type="button"
//                     >
//                       <span className="ai-modal-tab-label">Reply {i + 1}</span>
//                     </button>
//                   ))}
//                 </div>
//                 <div className="ai-modal-body">
//                   {suggestions[activeTab] && (
//                     <div className="ai-modal-base-suggestion">
//                       <span className="ai-modal-base-label">Based on:</span>
//                       <span className="ai-modal-base-text">{suggestions[activeTab]}</span>
//                     </div>
//                   )}
//                   {detailedModal.answers[activeTab] ? (
//                     <div className="ai-modal-answer-block" style={{ '--answer-color': TAB_COLORS[activeTab]?.color }}>
//                       {detailedModal.answers[activeTab].text}
//                     </div>
//                   ) : (
//                     <div className="ai-modal-answer-empty">No answer generated for this reply.</div>
//                   )}
//                 </div>
//                 <div className="ai-modal-footer">
//                   <button className="ai-modal-regenerate" onClick={handleOpenDetailed} type="button">↻ Regenerate All</button>
//                   {detailedModal.answers[activeTab] && (
//                     <button
//                       className="ai-modal-use"
//                       style={{ background: TAB_COLORS[activeTab]?.color }}
//                       onClick={() => { onSelectSuggestion(detailedModal.answers[activeTab].text); setDetailedModal(null); }}
//                       type="button"
//                     >
//                       Use This Reply
//                     </button>
//                   )}
//                 </div>
//               </>
//             )}
//           </div>
//         </div>
//       )}
//     </>
//   );
// }

// export default AISuggestions;





import React, { useState, useEffect, useRef, useMemo } from 'react';
import api from '../services/api';
import '../styles/Aisuggestions.css';

// Unpacks the API's `voiceFlags` into an index-keyed lookup.
// Server shape: [{ index, flags }] or [{ index, label, flags }]
// This is shape-handling, not rules. The voice rules live in exactly one
// place — backend/lib/voice-rules.js — so a second copy cannot drift out of
// sync and start flagging text the server already scrubbed.
function flagsByIndex(voiceFlags) {
  const map = {};
  if (!Array.isArray(voiceFlags)) return map;
  for (const entry of voiceFlags) {
    if (Number.isInteger(entry?.index)) map[entry.index] = Array.isArray(entry.flags) ? entry.flags : [];
  }
  return map;
}

// Unpacks the API's `aiTells` into the SAME index-keyed flag shape as
// flagsByIndex, so both streams render through one path.
//
// The server reports these instead of rewriting them: it used to delete the
// offending phrase in place, which left a stub mid-sentence and stripped warmth
// without adding any. A tell is now something the agent sees and decides about,
// so the draft underneath it is exactly what the model wrote.
//
// Server shape: [{ index, tells: [{ label, match }] }]
function tellsByIndex(aiTells) {
  const map = {};
  if (!Array.isArray(aiTells)) return map;
  for (const entry of aiTells) {
    if (!Number.isInteger(entry?.index)) continue;
    map[entry.index] = (Array.isArray(entry.tells) ? entry.tells : []).map(t => ({
      code: 'aitell',
      label: t.label,
      detail: t.match ? `reads as AI: "${t.match}"` : 'reads as AI',
    }));
  }
  return map;
}

// Concatenates two index-keyed flag maps without losing either side.
function mergeFlagMaps(a, b) {
  const out = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    out[key] = [...(a[key] || []), ...(b[key] || [])];
  }
  return out;
}

// Human-readable text for the fallback codes the suggestions route can return.
// The route is the source of truth for WHICH code fires; this map only decides
// how it reads to an agent. An unrecognised code is shown verbatim rather than
// swallowed, so a new backend code surfaces on day one instead of silently
// collapsing back to the generic line.
const FALLBACK_REASONS = {
  // Configuration
  no_api_key:             'No AI provider key is configured on the server.',

  // The model answered, but not usably
  parse_failed:           'The model reply could not be read as JSON.',
  shape_mismatch:         'The model returned JSON in the wrong shape.',

  // A safety guard did its job — these are working as intended, not outages
  number_contamination:   'Every reply carried a dose figure the brain does not authorise.',
  unauthorised_dose_leak: 'The brain has no dosing entry for this product, but every reply stated one.',
  unauthorised_commitment:'Every reply promised something the brain does not authorise.',
  unauthorised_upgrade:   'Every reply offered a shipping upgrade nobody approved.',
  all_filtered:           'Validation removed every reply the model produced.',

  // The route itself threw
  endpoint_error:         'The suggestions route failed before it could return a reply.',
};

// Server shape: { fallback: true, fallbackReason: 'deepseek_timeout', fallbackDetail?: '...' }
// Older backends send `reason`. Backends predating the whole field send nothing —
// in that case there is no reason line and the notice reads as it always did.
function describeFallback(data) {
  const code = data?.fallbackReason || data?.reason || data?.fallback_reason || null;
  const detail = data?.fallbackDetail || data?.fallback_detail || null;
  if (!code && !detail) return { code: null, message: null };
  const base = code ? (FALLBACK_REASONS[code] || String(code)) : null;
  const message = [base, detail].filter(Boolean).join(' ');
  return { code: code || null, message: message || null };
}

function AISuggestions({ conversation, messages, onSelectSuggestion }) {
  const [suggestions, setSuggestions]           = useState([]);
  const [needsReview, setNeedsReview]           = useState([]);
  const [isFallback, setIsFallback]             = useState(false);
  const [fallbackInfo, setFallbackInfo]         = useState({ code: null, message: null });
  const [fallbackAttempts, setFallbackAttempts] = useState(0);
  const [loading, setLoading]                   = useState(false);
  const [error, setError]                       = useState(null);
  const [collapsed, setCollapsed]               = useState(false);
  const [contextLevel, setContextLevel]         = useState('none');
  const [readyToGenerate, setReadyToGenerate]   = useState(false);
  const lastProcessedMsgId                      = useRef(null);

  // Voice flags come from the API (backend/lib/voice-rules.js). No entry for an
  // index means that reply was clean. If the backend predates the voice pass it
  // sends nothing and no chips render — the panel behaves as it did before.
  const [serverVoiceFlags, setServerVoiceFlags] = useState({});

  const [isEditing, setIsEditing]               = useState(false);
  const [editedMessage, setEditedMessage]       = useState('');
  const [adminNote, setAdminNote]               = useState('');
  const [messageWasEdited, setMessageWasEdited] = useState(false);
  const editTextareaRef                         = useRef(null);

  const [detailedModal, setDetailedModal]       = useState(null);
  // ── Panel width ────────────────────────────────────────────────────────────
  // Agents read long drafts in this panel and 300px forces most of them to wrap
  // into a narrow column. The left edge is draggable; the chosen width is per
  // browser, so one agent widening it does not change anyone else's layout.
  //
  // These are hooks, so they must stay inside the component body. An earlier
  // revision of this block landed at module scope and every admin page render
  // died on "Cannot read properties of null (reading 'useState')".
  const PANEL_MIN_WIDTH = 260;
  const PANEL_MAX_WIDTH = 900;
  const PANEL_WIDTH_KEY = 'ai-panel-width';

  const readStoredWidth = () => {
    try {
      const raw = parseInt(localStorage.getItem(PANEL_WIDTH_KEY), 10);
      if (Number.isFinite(raw)) return Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, raw));
    } catch {
      // Private mode, blocked site data — fall through to the default.
    }
    return 300;
  };

  // ── Suggestion cache ───────────────────────────────────────────────────────
  // Switching conversation and coming back used to wipe the panel and cost a
  // fresh generation: the effect below clears suggestions whenever the last
  // message id differs from lastProcessedMsgId, and that ref was shared across
  // every conversation, so any switch away and back always looked like a change.
  //
  // Keyed by conversation AND by the customer message the suggestions were
  // written for. A cached set is restored only while that message is still the
  // latest one — if the customer has said something since, the old suggestions
  // are genuinely stale and regenerating is correct.
  //
  // Deliberately in memory rather than storage: a full page reload should start
  // clean rather than restore drafts written against a conversation that may
  // have moved on while the tab was closed.
  const SUGGESTION_CACHE_MAX = 50;
  const suggestionCache = useRef(new Map());

  const cacheSuggestions = (convId, msgId, entry) => {
    if (convId == null || msgId == null) return;
    const cache = suggestionCache.current;
    const key = `${convId}:${msgId}`;
    cache.delete(key);            // re-insert so Map iteration order is LRU
    cache.set(key, entry);
    while (cache.size > SUGGESTION_CACHE_MAX) cache.delete(cache.keys().next().value);
  };

  const readCachedSuggestions = (convId, msgId) =>
    (convId == null || msgId == null) ? null : suggestionCache.current.get(`${convId}:${msgId}`) || null;

  const [panelWidth, setPanelWidth] = useState(readStoredWidth);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef(null);

  const clampWidth = (px) => Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, px));

  const persistWidth = (px) => {
    try { localStorage.setItem(PANEL_WIDTH_KEY, String(px)); } catch { /* not worth surfacing */ }
  };

  const startResize = (event) => {
    event.preventDefault();
    setIsResizing(true);

    // Dragging LEFT widens the panel, so the delta is inverted relative to x.
    const startX = event.clientX;
    const startWidth = panelRef.current?.getBoundingClientRect().width ?? panelWidth;

    const onMove = (moveEvent) => setPanelWidth(clampWidth(startWidth + (startX - moveEvent.clientX)));

    const onUp = (upEvent) => {
      const finalWidth = clampWidth(startWidth + (startX - upEvent.clientX));
      setPanelWidth(finalWidth);
      persistWidth(finalWidth);
      setIsResizing(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Keyboard equivalent, so the panel is not mouse-only.
  const nudgeWidth = (event) => {
    const step = event.shiftKey ? 50 : 10;
    let next = null;
    if (event.key === 'ArrowLeft')  next = clampWidth(panelWidth + step);
    if (event.key === 'ArrowRight') next = clampWidth(panelWidth - step);
    if (next === null) return;
    event.preventDefault();
    setPanelWidth(next);
    persistWidth(next);
  };

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
  const activeConvRef  = useRef(null);

  const TAB_COLORS = [
    { color: '#f59e0b' },
    { color: '#3b82f6' },
    { color: '#8b5cf6' },
    { color: '#10b981' },
  ];

  // Single source of truth for "was this response a canned template?"
  const isFallbackResponse = (data) => data?.fallback === true || data?.source === 'fallback';

  // ── Reset ALL state when conversation changes ──────────────────────────────
  useEffect(() => {
    if (!conversation?.id) return;
    activeConvRef.current = conversation.id;
    setLoading(false);
    setImageAnalyzing(false);
    setSuggestions([]);
    setNeedsReview([]);
    setIsFallback(false);
    setFallbackInfo({ code: null, message: null });
    setFallbackAttempts(0);
    setServerVoiceFlags({});
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
  // Only ever returns a customer message that BELONGS to the conversation on
  // screen. During a switch, a late inbound message for the previous
  // conversation can still be in `messages` for a render — filtering by
  // conversation id here prevents it from seeding suggestions.
  const getLastCustomerMessage = () => {
    if (!messages?.length) return null;
    const activeId = conversation?.id;
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.senderType !== 'customer' || m._optimistic) continue;
      const mConv = m.conversationId ?? m.conversation_id;
      if (mConv != null && String(mConv) !== String(activeId)) continue; // foreign → skip
      return m;
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

    // The model is asked to answer "the ONE thing they asked" without repeating
    // or contradicting the agent, which it can only do from the actual exchange.
    // 40 was silently dropping the start of any longer thread, and a silent drop
    // is the worst version: the model reads a partial history as if it were the
    // whole one. Take more, and when it still does not fit, say so in the text
    // so the model knows it is looking at a tail rather than a beginning.
    const HISTORY_LIMIT = 60;
    const omitted = Math.max(0, messages.length - HISTORY_LIMIT);
    const historyLines = messages.slice(-HISTORY_LIMIT).map(m => {
      const role    = m.senderType === 'customer' ? 'Customer' : 'Agent';
      const content = m.content || (m.fileData ? `[File: ${m.fileData?.name || 'attachment'}]` : '');
      return `${role}: ${content}`;
    });
    if (omitted > 0) {
      historyLines.unshift(`[${omitted} earlier message${omitted === 1 ? '' : 's'} in this conversation are not shown]`);
    }
    const chatHistory = historyLines.join('\n');

    // Raw samples. The backend filters these through filterOnVoiceSamples()
    // before extractAdminStyle() learns from them — do not pre-filter here, the
    // server needs the drop count to spot a team-wide voice problem.
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

  // ── Payload ────────────────────────────────────────────────────────────────
  // No voice text is sent from here. The backend builds the voice block in
  // lib/voice-rules.js so it cannot be tampered with from the client and so a
  // rule change is one deploy, not two.
  //
  // opts.image / opts.analysisText → attach a specific image (state may not have
  //                                  flushed yet when called right after upload)
  // opts.includeImage: false       → hard-exclude the screenshot
  const buildPayload = (clientMessage, extra = {}, opts = {}) => {
    const { image = null, analysisText = null, includeImage = true } = opts;
    const { chatHistory, agentStyleSamples, analysis, recentContext } = buildConversationContext();

    const img         = image || (imageDismissed ? null : uploadedImage);
    const attachImage = includeImage && !!img;

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
      ...(attachImage ? {
        adminImage: { base64: img.base64, mimeType: img.mimeType, name: img.name },
        imageAnalysis: analysisText ?? imageAnalysis ?? null,
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

  // ── Core fetch — every suggestion path goes through here ───────────────────
  const runSuggestions = async (messageText, opts = {}) => {
    if (!messageText?.trim()) return;
    const { note, image = null, analysisText = null, includeImage = true, isRetry = false } = opts;
    const reqConv = conversation?.id;
    setReadyToGenerate(false);
    setLoading(true);
    setError(null);
    setSuggestions([]);
    setNeedsReview([]);
    setIsFallback(false);
    setFallbackInfo({ code: null, message: null });
    if (!isRetry) setFallbackAttempts(0);
    setServerVoiceFlags({});
    try {
      const payload = buildPayload(
        messageText,
        note !== undefined ? { adminNote: note || '' } : {},
        { image, analysisText, includeImage },
      );
      const data = await postToAI(payload);
      if (reqConv !== activeConvRef.current) return;   // switched mid-request — bail
      const fellBack = isFallbackResponse(data);
      const flags = mergeFlagMaps(flagsByIndex(data.voiceFlags), tellsByIndex(data.aiTells));
      setSuggestions(data.suggestions || []);
      setNeedsReview(data.needsReview || []);
      setIsFallback(fellBack);
      setFallbackInfo(fellBack ? describeFallback(data) : { code: null, message: null });
      setServerVoiceFlags(flags);

      // Keep them so returning to this conversation shows the same suggestions
      // instead of a blank panel and another generation.
      cacheSuggestions(reqConv, lastProcessedMsgId.current, {
        suggestions: data.suggestions || [],
        needsReview: data.needsReview || [],
        isFallback: fellBack,
        fallbackInfo: fellBack ? describeFallback(data) : { code: null, message: null },
        serverVoiceFlags: flags,
      });
    } catch (err) {
      if (reqConv !== activeConvRef.current) return;
      setError(`Could not generate suggestions: ${err.message}`);
    } finally {
      if (reqConv === activeConvRef.current) setLoading(false);
    }
  };

  const fetchSuggestions = (messageText, note) => runSuggestions(messageText, { note });

  const fetchSuggestionsWithImage = (messageText, imageData, imageAnalysisText) =>
    runSuggestions(messageText, { image: imageData, analysisText: imageAnalysisText });

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
    const reqConv = conversation?.id;
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
      const data = await res.json();
      if (reqConv !== activeConvRef.current) return;   // switched during vision call — bail
      const analysis = data.analysis || '';
      setImageAnalysis(analysis);
      const chatMsg = isEditedRef.current ? editedTextRef.current : getLastCustomerMessage()?.content;
      const msgText = chatMsg?.trim()
        ? chatMsg
        : '[Screenshot uploaded by agent — no customer message yet. Base your reply on the screenshot data.]';

      await fetchSuggestionsWithImage(msgText, imageData, analysis);
    } catch (err) {
      if (reqConv !== activeConvRef.current) return;
      setError(`Image analysis failed: ${err.message}`);
    } finally {
      if (reqConv === activeConvRef.current) setImageAnalyzing(false);
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
      if (msgText) runSuggestions(msgText, { note: adminNoteRef.current, includeImage: false });
    }
  };

  // ── New message: mark ready, don't auto-fetch ──────────────────────────────
  // Gated on conversation identity so a late inbound message for a DIFFERENT
  // conversation (arriving in the same render window as a switch) can never
  // flip this panel to "ready" or seed suggestions from a foreign message.
  useEffect(() => {
    const lastCustomerMsg = getLastCustomerMessage();
    if (!lastCustomerMsg) {
      setSuggestions([]);
      setIsFallback(false);
      setFallbackInfo({ code: null, message: null });
      setFallbackAttempts(0);
      setContextLevel('none');
      setReadyToGenerate(false);
      return;
    }

    // Guard: only react to messages belonging to the conversation on screen.
    const msgConvId = lastCustomerMsg.conversationId ?? lastCustomerMsg.conversation_id;
    if (msgConvId != null && String(msgConvId) !== String(conversation?.id)) return;

    const msgId = String(lastCustomerMsg.id);
    if (msgId === lastProcessedMsgId.current) return;

    // Coming back to a conversation whose suggestions we already have, with the
    // customer not having said anything since: restore them rather than clearing
    // the panel and charging for a regeneration of the same answer.
    const cached = readCachedSuggestions(conversation?.id, msgId);
    if (cached) {
      lastProcessedMsgId.current = msgId;
      setSuggestions(cached.suggestions);
      setNeedsReview(cached.needsReview);
      setIsFallback(cached.isFallback);
      setFallbackInfo(cached.fallbackInfo);
      setServerVoiceFlags(cached.serverVoiceFlags);
      setContextLevel(assessContextQuality());
      setReadyToGenerate(false);
      setError(null);
      return;
    }

    const quality = assessContextQuality();
    setContextLevel(quality);
    if (quality === 'none') {
      setSuggestions([]);
      setIsFallback(false);
      setFallbackInfo({ code: null, message: null });
      setFallbackAttempts(0);
      setReadyToGenerate(false);
      return;
    }

    lastProcessedMsgId.current = msgId;
    isEditedRef.current   = false;
    editedTextRef.current = '';
    adminNoteRef.current  = '';
    setEditedMessage('');
    setAdminNote('');
    setMessageWasEdited(false);
    setIsEditing(false);
    setSuggestions([]);
    setIsFallback(false);
    setFallbackInfo({ code: null, message: null });
    setFallbackAttempts(0);
    setServerVoiceFlags({});
    setError(null);
    setReadyToGenerate(true);
  }, [messages, conversation?.id]);

  useEffect(() => {
    return () => { if (uploadedImage?.previewUrl) URL.revokeObjectURL(uploadedImage.previewUrl); };
  }, []);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleGenerate = () => {
    const text = isEditedRef.current ? editedTextRef.current : getLastCustomerMessage()?.content;
    if (text) fetchSuggestions(text, adminNoteRef.current);
  };

  // Generate without screenshot — hard-excludes the image from the payload
  const handleGenerateWithoutScreenshot = () => {
    const text = isEditedRef.current ? editedTextRef.current : getLastCustomerMessage()?.content;
    if (!text) return;
    setImageDismissed(true);
    runSuggestions(text, { note: adminNoteRef.current, includeImage: false });
  };

  // Retry straight from the fallback notice. Same request as Refresh, but keeps
  // the attempt counter so the agent can see a second failure is a real pattern
  // and not a mis-click.
  const handleRetryFallback = () => {
    const text = isEditedRef.current ? editedTextRef.current : getLastCustomerMessage()?.content;
    if (!text) return;
    setFallbackAttempts(n => n + 1);
    runSuggestions(text, {
      note: adminNoteRef.current,
      includeImage: !imageDismissed && !!uploadedImage,
      isRetry: true,
    });
  };

  const handleOpenDetailed = async () => {
    if (!suggestions.length) return;
    const reqConv = conversation?.id;
    setDetailedModal({ loading: true, error: null, answers: [], fallback: false, fallbackInfo: { code: null, message: null }, voiceFlags: {} });
    setActiveTab(0);
    const lastCustomerMsg = getLastCustomerMessage();
    const clientMessage = isEditedRef.current ? editedTextRef.current : (lastCustomerMsg?.content || '');
    try {
      const data = await postToAI(buildPayload(clientMessage, { detailedAnswerMode: true, baseSuggestions: suggestions }));
      if (reqConv !== activeConvRef.current) return;   // switched mid-request — bail
      const fellBack = isFallbackResponse(data);
      setDetailedModal({
        loading: false,
        error: null,
        answers: data.detailedAnswers || [],
        fallback: fellBack,
        fallbackInfo: fellBack ? describeFallback(data) : { code: null, message: null },
        voiceFlags: mergeFlagMaps(flagsByIndex(data.voiceFlags), tellsByIndex(data.aiTells)),
      });
    } catch (err) {
      if (reqConv !== activeConvRef.current) return;
      setDetailedModal({ loading: false, error: `Failed to generate: ${err.message}`, answers: [], fallback: false, fallbackInfo: { code: null, message: null }, voiceFlags: {} });
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

  // ── Voice flags ────────────────────────────────────────────────────────────
  // Straight from the server. Nothing is linted client-side, so there is no
  // second rule set to fall out of sync with backend/lib/voice-rules.js.
  const suggestionFlags = useMemo(
    () => suggestions.map((_, i) => serverVoiceFlags[i] || []),
    [suggestions, serverVoiceFlags],
  );

  // The model chooses how many angles to return, so an index left over from a
  // previous, longer expansion can point past the end of this one.
  useEffect(() => {
    const count = detailedModal?.answers?.length ?? 0;
    if (count > 0 && activeTab >= count) setActiveTab(0);
  }, [detailedModal, activeTab]);

  const detailedFlags = useMemo(
    () => (detailedModal?.answers || []).map((_, i) => detailedModal.voiceFlags?.[i] || []),
    [detailedModal],
  );

  const renderFlags = (flags) => {
    if (!flags?.length) return null;
    const title = flags.map(f => (f.detail ? `${f.label}: ${f.detail}` : f.label)).join('\n');
    return (
      <span className="ai-voice-flags" title={`Off-voice:\n${title}`}>
        {flags.slice(0, 3).map(f => (
          <span key={f.code} className={`ai-voice-flag ai-voice-flag--${f.code}`}>{f.label}</span>
        ))}
        {flags.length > 3 && <span className="ai-voice-flag">+{flags.length - 3}</span>}
      </span>
    );
  };

  // ── Fallback notice ────────────────────────────────────────────────────────
  // One renderer for both the panel and the modal. `info.message` is only
  // present when the backend sent a reason — older backends still get the
  // single-line notice they always showed.
  const renderFallbackNotice = ({ info, onRetry, retrying, modal = false, attempts = 0 }) => {
    const reason = info?.message || null;
    return (
      <div
        className={`ai-fallback-notice${modal ? ' ai-fallback-notice--modal' : ''}`}
        role="alert"
        title={reason ? `AI unavailable — ${reason}` : 'AI was unavailable — these are canned templates. Review before sending.'}
      >
        <span className="ai-fallback-notice-icon">⚠</span>
        <div className="ai-fallback-notice-content">
          <span className="ai-fallback-notice-text">
            AI unavailable — these are templates. Review before sending.
          </span>
          {reason && (
            <span className="ai-fallback-notice-reason">
              {reason}
              {info?.code && <code className="ai-fallback-notice-code">{info.code}</code>}
            </span>
          )}
          {attempts > 1 && (
            <span className="ai-fallback-notice-attempts">
              Retried {attempts} times — still falling back.
            </span>
          )}
        </div>
        {onRetry && (
          <button
            className="ai-fallback-retry-btn"
            onClick={onRetry}
            disabled={retrying}
            type="button"
            title="Send the request to the AI again"
          >
            {retrying ? 'Retrying…' : '↻ Retry AI'}
          </button>
        )}
      </div>
    );
  };

  const lastCustomerMsg  = getLastCustomerMessage();
  const contextIndicator = getContextIndicator();
  const hasScreenshot    = uploadedImage && !imageDismissed;

  if (!conversation || !lastCustomerMsg) return null;

  return (
    <>
      <div
        ref={panelRef}
        className={`ai-suggestions-panel ${collapsed ? 'collapsed' : ''} ${isResizing ? 'is-resizing' : ''} ${pasteHighlight ? 'ai-paste-highlight' : ''}`}
        style={{ '--ai-panel-width': `${panelWidth}px` }}
      >
        {!collapsed && (
          <button
            type="button"
            className="ai-resize-handle"
            onPointerDown={startResize}
            onKeyDown={nudgeWidth}
            aria-label="Resize AI suggestions panel"
            title="Drag to resize, or focus and use the arrow keys"
          />
        )}

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

            {/* ── Fallback notice — AI unavailable, canned templates shown ── */}
            {isFallback && suggestions.length > 0 && !loading && renderFallbackNotice({
              info: fallbackInfo,
              onRetry: handleRetryFallback,
              retrying: loading || imageAnalyzing,
              attempts: fallbackAttempts,
            })}

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
              ) : suggestions.map((s, i) => {
                const flags = suggestionFlags[i] || [];
                return (
                  <button
                    key={i}
                    className={`ai-suggestion-card ${isFallback ? 'ai-suggestion-card--fallback' : ''} ${flags.length ? 'ai-suggestion-card--offvoice' : ''}`}
                    onClick={() => onSelectSuggestion(s)}
                    type="button"
                  >
                    <span className="ai-suggestion-number">{i + 1}</span>
                    <span className="ai-suggestion-text">{s}</span>
                    {isFallback && <span className="ai-suggestion-fallback-tag" title="Canned template">template</span>}
                    {renderFlags(flags)}
                  </button>
                );
              })}
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
                {detailedModal.fallback && renderFallbackNotice({
                  info: detailedModal.fallbackInfo,
                  onRetry: handleOpenDetailed,
                  retrying: detailedModal.loading,
                  modal: true,
                })}
                {/* One tab per angle the model actually chose, labelled with what
                    that angle DOES. These used to be three fixed tabs reading
                    "Reply 1/2/3" while the model's own labels were generated and
                    then thrown away — so the agent had to open each one to find
                    out how they differed, and the model was paying tokens to fill
                    a fixed three-rung ladder nobody saw. */}
                <div className="ai-modal-tabs">
                  {detailedModal.answers.map((a, i) => (
                    <button
                      key={i}
                      className={`ai-modal-tab ${activeTab === i ? 'active' : ''} ${detailedFlags[i]?.length ? 'ai-modal-tab--offvoice' : ''}`}
                      style={{ '--tab-color': TAB_COLORS[i]?.color }}
                      onClick={() => setActiveTab(i)}
                      title={a.why || a.label || `Reply ${i + 1}`}
                      type="button"
                    >
                      <span className="ai-modal-tab-label">{a.label || `Reply ${i + 1}`}</span>
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
                    <>
                      {detailedModal.answers[activeTab].why && (
                        <div className="ai-modal-answer-why">
                          {detailedModal.answers[activeTab].why}
                        </div>
                      )}
                      <div className="ai-modal-answer-block" style={{ '--answer-color': TAB_COLORS[activeTab]?.color }}>
                        {detailedModal.answers[activeTab].text}
                      </div>
                      {detailedFlags[activeTab]?.length > 0 && (
                        <div className="ai-voice-flags ai-voice-flags--modal">
                          <span className="ai-voice-flags-label">Off-voice:</span>
                          {detailedFlags[activeTab].map(f => (
                            <span
                              key={f.code}
                              className={`ai-voice-flag ai-voice-flag--${f.code}`}
                              title={f.detail || f.label}
                            >{f.label}</span>
                          ))}
                        </div>
                      )}
                    </>
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