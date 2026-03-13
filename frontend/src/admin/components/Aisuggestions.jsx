// import React, { useState, useEffect, useRef } from 'react';
// import api from '../services/api'
// import '../styles/Aisuggestions.css';

// function AISuggestions({ conversation, messages, onSelectSuggestion }) {
//   const [suggestions, setSuggestions] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState(null);
//   const [collapsed, setCollapsed] = useState(false);
//   const lastProcessedMsgId = useRef(null);

//   // Editable message & admin instructions
//   const [isEditing, setIsEditing] = useState(false);
//   const [editedMessage, setEditedMessage] = useState('');
//   const [adminNote, setAdminNote] = useState('');
//   const [messageWasEdited, setMessageWasEdited] = useState(false);
//   const editTextareaRef = useRef(null);

//   // Get the last customer message from the messages array
//   const getLastCustomerMessage = () => {
//     if (!messages || messages.length === 0) return null;
//     for (let i = messages.length - 1; i >= 0; i--) {
//       if (messages[i].senderType === 'customer' && !messages[i]._optimistic) {
//         return messages[i];
//       }
//     }
//     return null;
//   };

//   /**
//    * Build a rich context object from the full conversation history.
//    * This gives the AI much more to work with than a flat string.
//    */
//   const buildConversationContext = () => {
//     if (!messages || messages.length === 0) return { chatHistory: '', analysis: {} };

//     // ── Format the last 20 messages as chat history ──
//     const recent = messages.slice(-20);
//     const chatHistory = recent
//       .map(m => {
//         const role = m.senderType === 'customer' ? 'Customer' : 'Agent';
//         const content = m.content || (m.fileData ? `[Sent a file: ${m.fileData?.name || 'attachment'}]` : '');
//         return `${role}: ${content}`;
//       })
//       .join('\n');

//     // ── Analyze the conversation to extract useful signals ──
//     const customerMessages = messages.filter(m => m.senderType === 'customer');
//     const agentMessages = messages.filter(m => m.senderType === 'agent');
//     const allCustomerText = customerMessages.map(m => (m.content || '').toLowerCase()).join(' ');

//     // Detect topics mentioned across the FULL conversation
//     const topicKeywords = {
//       order_status: ['order', 'tracking', 'shipped', 'delivery', 'deliver', 'where is', 'status', 'when will'],
//       refund_return: ['refund', 'return', 'money back', 'cancel', 'cancellation', 'exchange'],
//       product_issue: ['broken', 'damaged', 'defective', 'wrong item', 'missing', 'not working', 'doesn\'t work', 'issue with'],
//       payment: ['payment', 'charged', 'charge', 'billing', 'invoice', 'receipt', 'credit card', 'declined'],
//       discount_promo: ['discount', 'coupon', 'promo', 'code', 'sale', 'offer', 'deal'],
//       product_inquiry: ['product', 'item', 'size', 'color', 'stock', 'available', 'price', 'how much'],
//       shipping: ['shipping', 'ship', 'freight', 'express', 'standard', 'free shipping', 'shipping cost'],
//       account: ['account', 'login', 'password', 'sign in', 'email', 'profile', 'update my'],
//       complaint: ['complaint', 'unacceptable', 'terrible', 'worst', 'angry', 'frustrated', 'disappointed', 'horrible', 'disgusting', 'scam'],
//       gratitude: ['thank', 'thanks', 'appreciate', 'helpful', 'great', 'awesome', 'perfect', 'solved'],
//       greeting: ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening'],
//     };

//     const detectedTopics = [];
//     for (const [topic, keywords] of Object.entries(topicKeywords)) {
//       if (keywords.some(kw => allCustomerText.includes(kw))) {
//         detectedTopics.push(topic);
//       }
//     }

//     // Detect customer sentiment
//     const lastCustMsg = customerMessages.length > 0 ? customerMessages[customerMessages.length - 1] : null;
//     const lastCustText = (lastCustMsg?.content || '').toLowerCase();

//     const negativeWords = ['angry', 'frustrated', 'upset', 'terrible', 'horrible', 'worst', 'unacceptable', 'disappointed', 'annoyed', 'furious', 'scam', 'ridiculous', 'disgusting', 'pathetic', 'useless'];
//     const positiveWords = ['thank', 'thanks', 'great', 'awesome', 'perfect', 'helpful', 'appreciate', 'amazing', 'wonderful', 'love', 'excellent', 'solved', 'happy'];
//     const urgentWords = ['urgent', 'asap', 'immediately', 'emergency', 'right now', 'please hurry', 'critical', 'time sensitive'];

//     const negCount = negativeWords.filter(w => lastCustText.includes(w)).length;
//     const posCount = positiveWords.filter(w => lastCustText.includes(w)).length;
//     const isUrgent = urgentWords.some(w => lastCustText.includes(w));

//     let sentiment = 'neutral';
//     if (negCount >= 2) sentiment = 'very_negative';
//     else if (negCount >= 1) sentiment = 'negative';
//     else if (posCount >= 2) sentiment = 'very_positive';
//     else if (posCount >= 1) sentiment = 'positive';

//     // Detect if the customer is asking a question
//     const isQuestion = lastCustText.includes('?') ||
//       /^(can |could |how |what |where |when |why |is |are |do |does |will |would |who |which |have )/.test(lastCustText.trim());

//     // Detect if customer is repeating / following up
//     const isRepeat = customerMessages.length >= 2 &&
//       customerMessages.slice(-3).some(m => {
//         const t = (m.content || '').toLowerCase();
//         return t.includes('again') || t.includes('already told') || t.includes('i said') || t.includes('still') || t.includes('follow up') || t.includes('any update');
//       });

//     // Check if customer shared specific data
//     const hasOrderNumber = /(?:order|#)\s*#?\s*\d{3,}/i.test(allCustomerText) || /#\d{3,}/.test(allCustomerText);
//     const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(allCustomerText);
//     const hasAttachment = customerMessages.some(m => m.fileData || m.fileUrl);

//     // Conversation length
//     const turnCount = messages.length;
//     const isLongConversation = turnCount > 10;

//     // Agent history analysis — avoid repeating what was already said/asked
//     const lastAgentMsg = agentMessages.length > 0 ? agentMessages[agentMessages.length - 1] : null;
//     const lastAgentText = lastAgentMsg?.content || '';
//     const allAgentText = agentMessages.map(m => (m.content || '').toLowerCase()).join(' ');

//     const agentAskedForOrder = allAgentText.includes('order number') || allAgentText.includes('order #');
//     const agentAlreadyApologized = allAgentText.includes('sorry') || allAgentText.includes('apologize');
//     const agentAskedForEmail = allAgentText.includes('email address') || allAgentText.includes('your email');
//     const agentAskedForPhoto = allAgentText.includes('photo') || allAgentText.includes('picture') || allAgentText.includes('screenshot');
//     const agentOfferedRefund = allAgentText.includes('refund') || allAgentText.includes('money back');
//     const agentOfferedReplacement = allAgentText.includes('replacement') || allAgentText.includes('replace');

//     return {
//       chatHistory,
//       analysis: {
//         detectedTopics,
//         sentiment,
//         isUrgent,
//         isQuestion,
//         isRepeat,
//         hasOrderNumber,
//         hasEmail,
//         hasAttachment,
//         turnCount,
//         isLongConversation,
//         lastAgentText,
//         agentAskedForOrder,
//         agentAlreadyApologized,
//         agentAskedForEmail,
//         agentAskedForPhoto,
//         agentOfferedRefund,
//         agentOfferedReplacement,
//         customerMessageCount: customerMessages.length,
//         agentMessageCount: agentMessages.length,
//       }
//     };
//   };

//   // Track if admin has overridden the message (ref so useEffect doesn't override)
//   const isEditedRef = useRef(false);
//   const editedTextRef = useRef('');
//   const adminNoteRef = useRef('');

//   // Fetch suggestions when a NEW customer message arrives
//   // (not when admin edits — that's handled separately)
//   useEffect(() => {
//     const lastCustomerMsg = getLastCustomerMessage();
//     if (!lastCustomerMsg) {
//       setSuggestions([]);
//       return;
//     }

//     const msgId = String(lastCustomerMsg.id);
//     if (msgId === lastProcessedMsgId.current) return;

//     // New message arrived — reset any edits and fetch fresh
//     lastProcessedMsgId.current = msgId;
//     isEditedRef.current = false;
//     editedTextRef.current = '';
//     adminNoteRef.current = '';
//     setEditedMessage('');
//     setAdminNote('');
//     setMessageWasEdited(false);
//     setIsEditing(false);
//     fetchSuggestions(lastCustomerMsg.content);
//   }, [messages]);

//   // Core fetch — always sends whatever text it receives
//   const fetchSuggestions = async (messageText, note) => {
//     if (!messageText || !messageText.trim()) return;

//     setLoading(true);
//     setError(null);
//     setSuggestions([]);

//     try {
//       const { chatHistory, analysis } = buildConversationContext();

//       // Use the same base URL as the rest of the app
//       const baseUrl = api.baseUrl || import.meta.env.VITE_API_URL || '';
//       const url = `${baseUrl}/api/ai/suggestions`;
//       console.log(`✦ [AI] Fetching suggestions from: ${url}`);

//       const response = await fetch(url, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           'Authorization': `Bearer ${localStorage.getItem('token')}`,
//         },
//         body: JSON.stringify({
//           clientMessage: messageText.trim(),
//           chatHistory,
//           conversationId: conversation?.id,
//           customerName: conversation?.customerName,
//           customerEmail: conversation?.customerEmail,
//           storeName: conversation?.storeName || conversation?.storeIdentifier,
//           storeIdentifier: conversation?.storeIdentifier,
//           analysis,
//           adminNote: note || '',
//           messageEdited: isEditedRef.current,
//         }),
//       });

//       if (!response.ok) {
//         const errorText = await response.text();
//         console.error(`✦ [AI] Server returned ${response.status}:`, errorText);
//         throw new Error(`Server ${response.status}: ${errorText.substring(0, 100)}`);
//       }

//       const data = await response.json();
//       console.log('✦ [AI] Got suggestions:', data.suggestions?.length, data.fallback ? '(fallback)' : '');
//       setSuggestions(data.suggestions || []);
//     } catch (err) {
//       console.error('✦ [AI] Suggestion error:', err.message || err);
//       setError(`Could not generate suggestions: ${err.message || 'Unknown error'}`);
//       setSuggestions([]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Refresh button — re-fetches with current state (edited or original)
//   const handleRefresh = () => {
//     if (isEditedRef.current && editedTextRef.current.trim()) {
//       fetchSuggestions(editedTextRef.current.trim(), adminNoteRef.current.trim());
//     } else {
//       const lastCustomerMsg = getLastCustomerMessage();
//       if (lastCustomerMsg) {
//         fetchSuggestions(lastCustomerMsg.content, adminNoteRef.current.trim());
//       }
//     }
//   };

//   const handleStartEdit = () => {
//     const lastCustomerMsg = getLastCustomerMessage();
//     if (lastCustomerMsg) {
//       const text = isEditedRef.current ? editedTextRef.current : (lastCustomerMsg.content || '');
//       setEditedMessage(text);
//       setIsEditing(true);
//       setTimeout(() => editTextareaRef.current?.focus(), 50);
//     }
//   };

//   const handleCancelEdit = () => {
//     setIsEditing(false);
//     // Restore from refs (don't lose previous edits)
//     if (!isEditedRef.current) {
//       setEditedMessage('');
//       setAdminNote('');
//     }
//   };

//   // ✦ This is the key action — sends the edited text to AI
//   const handleApplyEdit = () => {
//     if (!editedMessage.trim()) return;

//     // Save to refs so useEffect can't override
//     isEditedRef.current = true;
//     editedTextRef.current = editedMessage.trim();
//     adminNoteRef.current = adminNote.trim();

//     setIsEditing(false);
//     setMessageWasEdited(true);

//     // Fetch with the NEW edited text
//     fetchSuggestions(editedMessage.trim(), adminNote.trim());
//   };

//   const handleResetToOriginal = () => {
//     const lastCustomerMsg = getLastCustomerMessage();

//     // Clear all edit state
//     isEditedRef.current = false;
//     editedTextRef.current = '';
//     adminNoteRef.current = '';
//     setIsEditing(false);
//     setEditedMessage('');
//     setMessageWasEdited(false);
//     setAdminNote('');

//     // Re-fetch with the original message
//     if (lastCustomerMsg) {
//       fetchSuggestions(lastCustomerMsg.content);
//     }
//   };

//   const lastCustomerMsg = getLastCustomerMessage();

//   if (!conversation || !lastCustomerMsg) return null;

//   return (
//     <div className={`ai-suggestions-panel ${collapsed ? 'collapsed' : ''}`}>
//       <div className="ai-suggestions-header">
//         <div className="ai-suggestions-title">
//           <span className="ai-icon">✦</span>
//           <span>AI Suggestions</span>
//         </div>
//         <div className="ai-suggestions-actions">
//           <button
//             className="ai-btn-icon"
//             onClick={handleRefresh}
//             disabled={loading}
//             title="Regenerate suggestions"
//             type="button"
//           >
//             ↻
//           </button>
//           <button
//             className="ai-btn-icon"
//             onClick={() => setCollapsed(!collapsed)}
//             title={collapsed ? 'Expand' : 'Collapse'}
//             type="button"
//           >
//             {collapsed ? '◂' : '▸'}
//           </button>
//         </div>
//       </div>

//       {!collapsed && (
//         <div className="ai-suggestions-body">
//           {/* ── Context: editable customer message ── */}
//           <div className="ai-context-section">
//             <div className="ai-context-header">
//               <span className="ai-context-label">Replying to:</span>
//               {!isEditing && (
//                 <button
//                   className="ai-edit-msg-btn"
//                   onClick={handleStartEdit}
//                   title="Edit message to refine AI suggestions"
//                   type="button"
//                 >
//                   ✎ Edit
//                 </button>
//               )}
//               {messageWasEdited && !isEditing && (
//                 <button
//                   className="ai-reset-msg-btn"
//                   onClick={handleResetToOriginal}
//                   title="Reset to original message"
//                   type="button"
//                 >
//                   ↩ Original
//                 </button>
//               )}
//             </div>

//             {isEditing ? (
//               <div className="ai-edit-area">
//                 <textarea
//                   ref={editTextareaRef}
//                   className="ai-edit-textarea"
//                   value={editedMessage}
//                   onChange={(e) => setEditedMessage(e.target.value)}
//                   placeholder="Edit the customer's message..."
//                   rows={3}
//                 />
//                 <textarea
//                   className="ai-note-textarea"
//                   value={adminNote}
//                   onChange={(e) => setAdminNote(e.target.value)}
//                   placeholder="Instructions for AI (optional): e.g. 'include refund policy', 'ask for order number', 'be more empathetic'..."
//                   rows={2}
//                 />
//                 <div className="ai-edit-actions">
//                   <button className="ai-edit-cancel" onClick={handleCancelEdit} type="button">
//                     Cancel
//                   </button>
//                   <button
//                     className="ai-edit-apply"
//                     onClick={handleApplyEdit}
//                     disabled={!editedMessage.trim()}
//                     type="button"
//                   >
//                     ✦ Re-generate
//                   </button>
//                 </div>
//               </div>
//             ) : (
//               <div className={`ai-context-message ${messageWasEdited ? 'edited' : ''}`}>
//                 {messageWasEdited && <span className="ai-edited-badge">edited</span>}
//                 {(messageWasEdited ? editedMessage : lastCustomerMsg.content)
//                   ? (messageWasEdited ? editedMessage : lastCustomerMsg.content).length > 150
//                     ? (messageWasEdited ? editedMessage : lastCustomerMsg.content).substring(0, 150) + '...'
//                     : (messageWasEdited ? editedMessage : lastCustomerMsg.content)
//                   : '(file attachment)'}
//                 {adminNote && !isEditing && (
//                   <div className="ai-note-preview">
//                     <span className="ai-note-prefix">AI note:</span> {adminNote}
//                   </div>
//                 )}
//               </div>
//             )}
//           </div>

//           <div className="ai-suggestions-list">
//             {loading ? (
//               <div className="ai-loading">
//                 <div className="ai-loading-dots">
//                   <span></span><span></span><span></span>
//                 </div>
//                 <p>Generating suggestions...</p>
//               </div>
//             ) : error && suggestions.length === 0 ? (
//               <div className="ai-error">
//                 <p>{error}</p>
//                 <button onClick={handleRefresh} type="button" className="ai-retry-btn">
//                   Try Again
//                 </button>
//               </div>
//             ) : (
//               suggestions.map((suggestion, index) => (
//                 <button
//                   key={index}
//                   className="ai-suggestion-card"
//                   onClick={() => onSelectSuggestion(suggestion)}
//                   type="button"
//                 >
//                   <span className="ai-suggestion-number">{index + 1}</span>
//                   <span className="ai-suggestion-text">{suggestion}</span>
//                 </button>
//               ))
//             )}
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// export default AISuggestions;




import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api'
import '../styles/Aisuggestions.css';

function AISuggestions({ conversation, messages, onSelectSuggestion }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [contextLevel, setContextLevel] = useState('none'); // 'none', 'minimal', 'basic', 'good', 'excellent'
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
   * Determine the quality of available context
   */
  const assessContextQuality = () => {
    if (!messages || messages.length === 0) return 'none';
    
    const customerMessages = messages.filter(m => m.senderType === 'customer' && !m._optimistic);
    const agentMessages = messages.filter(m => m.senderType === 'agent' && !m._optimistic);
    
    const customerCount = customerMessages.length;
    const agentCount = agentMessages.length;

    // Context quality levels:
    if (customerCount === 0) return 'none';
    if (customerCount === 1 && agentCount === 0) return 'minimal'; // First customer message
    if (customerCount >= 1 && agentCount >= 1 && (customerCount + agentCount) < 4) return 'basic'; // Some back and forth
    if (customerCount >= 2 && agentCount >= 2) return 'good'; // Ideal minimum
    if (customerCount >= 3 && agentCount >= 3) return 'excellent'; // Rich context
    
    return 'basic';
  };

  /**
   * Get the last N customer messages (or all if less than N)
   */
  const getLastCustomerMessages = (count = 2) => {
    if (!messages || messages.length === 0) return [];
    
    const customerMessages = messages
      .filter(m => m.senderType === 'customer' && !m._optimistic)
      .slice(-count);
    
    return customerMessages;
  };

  /**
   * Get the last N agent messages (or all if less than N)
   */
  const getLastAgentMessages = (count = 2) => {
    if (!messages || messages.length === 0) return [];
    
    const agentMessages = messages
      .filter(m => m.senderType === 'agent' && !m._optimistic)
      .slice(-count);
    
    return agentMessages;
  };

  /**
   * Build a rich context object from the full conversation history.
   * This gives the AI much more to work with than a flat string.
   */
const buildConversationContext = () => {
  if (!messages || messages.length === 0) return { chatHistory: '', analysis: {}, recentContext: null };

  // ── Format the last 20 messages as chat history ──
  const recent = messages.slice(-20);
  const chatHistory = recent
    .map(m => {
      const role = m.senderType === 'customer' ? 'Customer' : 'Agent';
      const content = m.content || (m.fileData ? `[Sent a file: ${m.fileData?.name || 'attachment'}]` : '');
      return `${role}: ${content}`;
    })
    .join('\n');

  // ── Get available customer and agent messages (max 2 each) ──
  const lastCustomerMessages = getLastCustomerMessages(2);
  const lastAgentMessages = getLastAgentMessages(2);

  // ── Analyze the conversation to extract useful signals ──
  const customerMessages = messages.filter(m => m.senderType === 'customer');
  const agentMessages = messages.filter(m => m.senderType === 'agent');
  const allCustomerText = customerMessages.map(m => (m.content || '').toLowerCase()).join(' ');
  const lastCustomerText = customerMessages[customerMessages.length - 1]?.content || '';

  // ── Extract key entities ──
  const orderNumberMatch = allCustomerText.match(/(?:order|#)\s*#?\s*(\d{4,})/i) || 
                           allCustomerText.match(/#(\d{4,})/) || 
                           allCustomerText.match(/\b(\d{5,})\b/);
  const orderNumber = orderNumberMatch ? orderNumberMatch[1] : null;

  const emailMatch = allCustomerText.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  const customerEmail = emailMatch ? emailMatch[0] : null;

  // ── Detect what kind of issue/request ──
  const issueTypes = {
    damaged: /broken|damaged|defective|cracked|shattered|crushed/i.test(allCustomerText),
    wrong_item: /wrong item|incorrect|not what i ordered|different/i.test(allCustomerText),
    missing: /missing|didn't receive|never arrived|lost/i.test(allCustomerText),
    late: /late|delayed|taking too long|still waiting/i.test(allCustomerText),
    quality: /poor quality|cheap|not as described|disappointed with quality/i.test(allCustomerText),
  };
  
  const detectedIssue = Object.keys(issueTypes).find(key => issueTypes[key]) || null;

  // ── What does customer want? ──
  const customerWants = {
    refund: /refund|money back/i.test(allCustomerText),
    replacement: /replacement|replace|send another|new one/i.test(allCustomerText),
    tracking: /tracking|where is|status|when will/i.test(allCustomerText),
    help: /help|assist|support/i.test(allCustomerText),
  };

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

  // Detect customer sentiment from available messages
  const availableCustomerText = lastCustomerMessages
    .map(m => (m.content || '').toLowerCase())
    .join(' ');

  const negativeWords = ['angry', 'frustrated', 'upset', 'terrible', 'horrible', 'worst', 'unacceptable', 'disappointed', 'annoyed', 'furious', 'scam', 'ridiculous', 'disgusting', 'pathetic', 'useless'];
  const positiveWords = ['thank', 'thanks', 'great', 'awesome', 'perfect', 'helpful', 'appreciate', 'amazing', 'wonderful', 'love', 'excellent', 'solved', 'happy'];
  const urgentWords = ['urgent', 'asap', 'immediately', 'emergency', 'right now', 'please hurry', 'critical', 'time sensitive'];

  const negCount = negativeWords.filter(w => availableCustomerText.includes(w)).length;
  const posCount = positiveWords.filter(w => availableCustomerText.includes(w)).length;
  const isUrgent = urgentWords.some(w => availableCustomerText.includes(w));

  let sentiment = 'neutral';
  if (negCount >= 2) sentiment = 'very_negative';
  else if (negCount >= 1) sentiment = 'negative';
  else if (posCount >= 2) sentiment = 'very_positive';
  else if (posCount >= 1) sentiment = 'positive';

  // Detect if the customer is asking a question
  const isQuestion = lastCustomerMessages.some(m => {
    const text = (m.content || '').toLowerCase();
    return text.includes('?') || /^(can |could |how |what |where |when |why |is |are |do |does |will |would |who |which |have )/.test(text.trim());
  });

  // Detect if customer is repeating / following up
  const isRepeat = customerMessages.length >= 2 &&
    customerMessages.slice(-3).some(m => {
      const t = (m.content || '').toLowerCase();
      return t.includes('again') || t.includes('already told') || t.includes('i said') || t.includes('still') || t.includes('follow up') || t.includes('any update');
    });

  // Check if customer shared specific data
  const hasOrderNumber = !!orderNumber;
  const hasEmail = !!customerEmail;
  const hasAttachment = customerMessages.some(m => m.fileData || m.fileUrl);

  // Message richness
  const wordCount = lastCustomerText.split(/\s+/).filter(w => w.length > 0).length;
  const messageRichness = wordCount >= 30 ? 'very_detailed' : 
                          wordCount >= 15 ? 'detailed' : 
                          wordCount >= 5 ? 'brief' : 'very_brief';

  // Conversation length
  const turnCount = messages.length;
  const isLongConversation = turnCount > 10;

  // Agent history analysis — avoid repeating what was already said/asked
  const lastAgentMsg = agentMessages.length > 0 ? agentMessages[agentMessages.length - 1] : null;
  const lastAgentText = lastAgentMsg?.content || '';
  const allAgentText = agentMessages.map(m => (m.content || '').toLowerCase()).join(' ');
  
  // Analyze available agent messages
  const availableAgentText = lastAgentMessages
    .map(m => (m.content || '').toLowerCase())
    .join(' ');

  const agentAskedForOrder = allAgentText.includes('order number') || allAgentText.includes('order #');
  const agentAlreadyApologized = availableAgentText.includes('sorry') || availableAgentText.includes('apologize');
  const agentAskedForEmail = allAgentText.includes('email address') || allAgentText.includes('your email');
  const agentAskedForPhoto = allAgentText.includes('photo') || allAgentText.includes('picture') || allAgentText.includes('screenshot');
  const agentOfferedRefund = availableAgentText.includes('refund') || availableAgentText.includes('money back');
  const agentOfferedReplacement = availableAgentText.includes('replacement') || availableAgentText.includes('replace');

  return {
    chatHistory,
    recentContext: {
      lastCustomerMessages: lastCustomerMessages.map(m => m.content || '[attachment]'),
      lastAgentMessages: lastAgentMessages.map(m => m.content || ''),
      contextQuality: assessContextQuality(),
      messageRichness, // NEW: How detailed is the message
      detectedIssue, // NEW: What's wrong (damaged, wrong_item, etc.)
      customerWants, // NEW: What they're asking for
    },
    analysis: {
      detectedTopics,
      sentiment,
      isUrgent,
      isQuestion,
      isRepeat,
      hasOrderNumber,
      orderNumber,
      hasEmail,
      customerEmail,
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
      messageRichness, // How detailed the message is
      detectedIssue, // What kind of issue
      customerWants, // What they want
    }
  };
};


  // Track if admin has overridden the message (ref so useEffect doesn't override)
  const isEditedRef = useRef(false);
  const editedTextRef = useRef('');
  const adminNoteRef = useRef('');

  // Fetch suggestions when a NEW customer message arrives
  useEffect(() => {
    const lastCustomerMsg = getLastCustomerMessage();
    if (!lastCustomerMsg) {
      setSuggestions([]);
      setContextLevel('none');
      return;
    }

    const msgId = String(lastCustomerMsg.id);
    if (msgId === lastProcessedMsgId.current) return;

    // Assess context quality
    const quality = assessContextQuality();
    setContextLevel(quality);
    console.log(`✦ [AI] Context quality: ${quality}`);

    // If context is 'none', don't fetch
    if (quality === 'none') {
      setSuggestions([]);
      return;
    }

    // Fetch suggestions for ANY context level (minimal, basic, good, excellent)
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
      const { chatHistory, analysis, recentContext } = buildConversationContext();

      // Use the same base URL as the rest of the app
      const baseUrl = api.baseUrl || import.meta.env.VITE_API_URL || '';
      const url = `${baseUrl}/api/ai/suggestions`;
      console.log(`✦ [AI] Fetching suggestions from: ${url}`);
      console.log(`✦ [AI] Context: ${recentContext?.lastCustomerMessages?.length || 0} customer messages, ${recentContext?.lastAgentMessages?.length || 0} agent messages`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          clientMessage: messageText.trim(),
          chatHistory,
          recentContext, // Send the focused context with quality indicator
          conversationId: conversation?.id,
          customerName: conversation?.customerName,
          customerEmail: conversation?.customerEmail,
          storeName: conversation?.storeName || conversation?.storeIdentifier,
          storeIdentifier: conversation?.storeIdentifier,
          analysis,
          adminNote: note || '',
          messageEdited: isEditedRef.current,
          brainSettings: (() => { try { return JSON.parse(localStorage.getItem('brain_suggestion_settings') || '{}'); } catch { return {}; } })(),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`✦ [AI] Server returned ${response.status}:`, errorText);
        throw new Error(`Server ${response.status}: ${errorText.substring(0, 100)}`);
      }

      const data = await response.json();
      console.log('✦ [AI] Got suggestions:', data.suggestions?.length, data.fallback ? '(fallback)' : '');
      setSuggestions(data.suggestions || []);
    } catch (err) {
      console.error('✦ [AI] Suggestion error:', err.message || err);
      setError(`Could not generate suggestions: ${err.message || 'Unknown error'}`);
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

  // Get context quality indicator
  const getContextIndicator = () => {
    switch (contextLevel) {
      case 'minimal':
        return { icon: '🔵', text: 'First message - suggestions may be general', color: '#3b82f6' };
      case 'basic':
        return { icon: '🟡', text: 'Basic context - suggestions improving', color: '#f59e0b' };
      case 'good':
        return { icon: '🟢', text: 'Good context - quality suggestions', color: '#10b981' };
      case 'excellent':
        return { icon: '🟢', text: 'Excellent context - high quality suggestions', color: '#059669' };
      default:
        return null;
    }
  };

  const contextIndicator = getContextIndicator();

  if (!conversation || !lastCustomerMsg) return null;

  return (
    <div className={`ai-suggestions-panel ${collapsed ? 'collapsed' : ''}`}>
      <div className="ai-suggestions-header">
        <div className="ai-suggestions-title">
          <span className="ai-icon">✦</span>
          <span>AI Suggestions</span>
          {contextIndicator && (
            <span 
              className="ai-context-indicator" 
              style={{ color: contextIndicator.color }}
              title={contextIndicator.text}
            >
              {contextIndicator.icon}
            </span>
          )}
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
          {/* Show context quality notice */}
          {contextIndicator && contextLevel !== 'excellent' && (
            <div className="ai-context-notice" style={{ borderLeftColor: contextIndicator.color }}>
              <span className="ai-context-notice-icon">{contextIndicator.icon}</span>
              <span className="ai-context-notice-text">{contextIndicator.text}</span>
            </div>
          )}

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