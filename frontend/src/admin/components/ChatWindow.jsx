
// import React, { useState, useEffect, useRef } from 'react';
// import { formatDistanceToNow } from 'date-fns';
// import heic2any from 'heic2any';
// import api from "../services/api";
// import MessageBubble from './MessageBubble';
// import CustomerInfo from './CustomerInfo';
// import AISuggestions from './Aisuggestions';
// import QuickReplies from './Quickreplies';
// import '../styles/ChatWindow.css';
// import { parseMarkdown } from '../../utils/parseMarkdown';

// // ============ EMOJI DATA ============
// const EMOJI_CATEGORIES = [
//   {
//     label: '😊 Smileys',
//     emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖'],
//   },
//   {
//     label: '👋 People',
//     emojis: ['👋','🤚','🖐','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦵','🦶','👂','🦻','👃','🫀','🫁','🧠','🦷','🦴','👀','👁','👅','👄'],
//   },
//   {
//     label: '❤️ Hearts',
//     emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉','☸️','✡️','🔯','🕎','☯️','☦️','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓'],
//   },
//   {
//     label: '🎉 Celebration',
//     emojis: ['🎉','🎊','🎈','🎁','🎀','🎗','🎟','🎫','🏆','🥇','🥈','🥉','🏅','🎖','🏵','🎪','🤹','🎭','🎨','🎬','🎤','🎧','🎼','🎵','🎶','🎹','🥁','🎷','🎺','🎸','🪕','🎻','🎲','♟','🎯','🎳','🎮','🎰','🧩'],
//   },
// ];

// function EmojiPicker({ onSelect, onClose }) {
//   const [activeCategory, setActiveCategory] = useState(0);
//   const [search, setSearch] = useState('');
//   const pickerRef = useRef(null);

//   const filteredEmojis = search.trim()
//     ? EMOJI_CATEGORIES.flatMap(c => c.emojis).filter(e => e.includes(search))
//     : EMOJI_CATEGORIES[activeCategory].emojis;

//   useEffect(() => {
//     const handleClickOutside = (e) => {
//       if (pickerRef.current && !pickerRef.current.contains(e.target)) onClose();
//     };
//     document.addEventListener('mousedown', handleClickOutside);
//     return () => document.removeEventListener('mousedown', handleClickOutside);
//   }, [onClose]);

//   return (
//     <div className="emoji-picker" ref={pickerRef}>
//       <div className="emoji-picker-search">
//         <input
//           type="text"
//           placeholder="Search emoji..."
//           value={search}
//           onChange={e => setSearch(e.target.value)}
//           className="emoji-search-input"
//           autoFocus
//         />
//       </div>
//       {!search && (
//         <div className="emoji-category-tabs">
//           {EMOJI_CATEGORIES.map((cat, i) => (
//             <button
//               key={i}
//               type="button"
//               className={`emoji-cat-tab${activeCategory === i ? ' active' : ''}`}
//               onClick={() => setActiveCategory(i)}
//               title={cat.label}
//             >
//               {cat.emojis[0]}
//             </button>
//           ))}
//         </div>
//       )}
//       <div className="emoji-grid">
//         {filteredEmojis.length > 0
//           ? filteredEmojis.map((emoji, i) => (
//               <button
//                 key={i}
//                 type="button"
//                 className="emoji-btn"
//                 onClick={() => { onSelect(emoji); }}
//               >
//                 {emoji}
//               </button>
//             ))
//           : <div className="emoji-no-results">No results</div>
//         }
//       </div>
//     </div>
//   );
// }

// // ============ SEND EMAIL MODAL ============
// function SendEmailModal({ conversation, onClose, onSend }) {
//   const customerEmail = conversation?.customerEmail || '';
//   const customerName = conversation?.customerName || 'Customer';

//   const [to, setTo] = useState(customerEmail);
//   const [subject, setSubject] = useState('');
//   const [body, setBody] = useState('');
//   const [sending, setSending] = useState(false);
//   const [sent, setSent] = useState(false);
//   const [error, setError] = useState('');
//   const bodyRef = useRef(null);

//   const handleSend = async () => {
//     if (!to.trim()) { setError('Recipient email is required.'); return; }
//     if (!subject.trim()) { setError('Subject is required.'); return; }
//     if (!body.trim()) { setError('Message body is required.'); return; }
//     setError('');
//     try {
//       setSending(true);
//       await onSend({ to: to.trim(), subject: subject.trim(), body: body.trim() });
//       setSent(true);
//     } catch (err) {
//       setError(err.message || 'Failed to send email. Please try again.');
//     } finally {
//       setSending(false);
//     }
//   };

//   return (
//     <div
//       style={{
//         position: 'fixed', inset: 0, zIndex: 10000,
//         background: 'rgba(11,20,26,0.55)',
//         display: 'flex', alignItems: 'center', justifyContent: 'center',
//         padding: '16px',
//       }}
//       onClick={onClose}
//     >
//       <div
//         style={{
//           background: '#fff',
//           borderRadius: '12px',
//           width: '100%',
//           maxWidth: '520px',
//           boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
//           overflow: 'hidden',
//           display: 'flex',
//           flexDirection: 'column',
//         }}
//         onClick={e => e.stopPropagation()}
//       >
//         <div style={{
//           background: '#00a884',
//           padding: '16px 20px',
//           display: 'flex',
//           alignItems: 'center',
//           justifyContent: 'space-between',
//         }}>
//           <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
//             <span style={{ fontSize: '20px' }}>✉️</span>
//             <div>
//               <div style={{ color: '#fff', fontWeight: 700, fontSize: '15px' }}>Send Email</div>
//               <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px' }}>{customerName}</div>
//             </div>
//           </div>
//           <button
//             type="button"
//             onClick={onClose}
//             style={{
//               background: 'rgba(255,255,255,0.2)', border: 'none',
//               borderRadius: '50%', width: '30px', height: '30px',
//               cursor: 'pointer', color: '#fff', fontSize: '15px',
//               display: 'flex', alignItems: 'center', justifyContent: 'center',
//             }}
//           >✕</button>
//         </div>

//         {sent ? (
//           <div style={{ padding: '40px 24px', textAlign: 'center' }}>
//             <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
//             <div style={{ fontSize: '17px', fontWeight: 700, color: '#111b21', marginBottom: '6px' }}>Email Sent!</div>
//             <div style={{ fontSize: '13px', color: '#667781', marginBottom: '24px' }}>Your message was sent to <strong>{to}</strong></div>
//             <button
//               type="button"
//               onClick={onClose}
//               style={{
//                 background: '#00a884', color: '#fff', border: 'none',
//                 borderRadius: '8px', padding: '10px 28px',
//                 fontSize: '14px', fontWeight: 600, cursor: 'pointer',
//               }}
//             >Close</button>
//           </div>
//         ) : (
//           <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
//             <div>
//               <label style={{ fontSize: '12px', fontWeight: 600, color: '#3b4a54', display: 'block', marginBottom: '5px' }}>To</label>
//               <input
//                 type="email"
//                 value={to}
//                 onChange={e => setTo(e.target.value)}
//                 placeholder="customer@example.com"
//                 style={{
//                   width: '100%', padding: '9px 12px',
//                   border: '1.5px solid #e9edef', borderRadius: '8px',
//                   fontSize: '14px', color: '#111b21', outline: 'none',
//                   boxSizing: 'border-box', background: '#f9fafb',
//                   transition: 'border-color 0.15s',
//                 }}
//                 onFocus={e => e.target.style.borderColor = '#00a884'}
//                 onBlur={e => e.target.style.borderColor = '#e9edef'}
//               />
//             </div>
//             <div>
//               <label style={{ fontSize: '12px', fontWeight: 600, color: '#3b4a54', display: 'block', marginBottom: '5px' }}>Subject</label>
//               <input
//                 type="text"
//                 value={subject}
//                 onChange={e => setSubject(e.target.value)}
//                 placeholder="e.g. Your order tracking update"
//                 style={{
//                   width: '100%', padding: '9px 12px',
//                   border: '1.5px solid #e9edef', borderRadius: '8px',
//                   fontSize: '14px', color: '#111b21', outline: 'none',
//                   boxSizing: 'border-box', background: '#f9fafb',
//                   transition: 'border-color 0.15s',
//                 }}
//                 onFocus={e => e.target.style.borderColor = '#00a884'}
//                 onBlur={e => e.target.style.borderColor = '#e9edef'}
//               />
//             </div>
//             <div>
//               <label style={{ fontSize: '12px', fontWeight: 600, color: '#3b4a54', display: 'block', marginBottom: '5px' }}>Message</label>
//               <textarea
//                 ref={bodyRef}
//                 value={body}
//                 onChange={e => setBody(e.target.value)}
//                 placeholder="Write your message here..."
//                 rows={6}
//                 style={{
//                   width: '100%', padding: '9px 12px',
//                   border: '1.5px solid #e9edef', borderRadius: '8px',
//                   fontSize: '14px', color: '#111b21', outline: 'none',
//                   boxSizing: 'border-box', background: '#f9fafb',
//                   resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5',
//                   transition: 'border-color 0.15s',
//                 }}
//                 onFocus={e => e.target.style.borderColor = '#00a884'}
//                 onBlur={e => e.target.style.borderColor = '#e9edef'}
//               />
//               <div style={{ fontSize: '11px', color: '#aab8c2', textAlign: 'right', marginTop: '3px' }}>
//                 {body.length} chars
//               </div>
//             </div>
//             {error && (
//               <div style={{
//                 background: '#fff5f5', border: '1px solid #fed7d7',
//                 borderRadius: '8px', padding: '10px 14px',
//                 fontSize: '13px', color: '#c53030',
//               }}>
//                 ⚠️ {error}
//               </div>
//             )}
//             <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '4px' }}>
//               <button
//                 type="button"
//                 onClick={onClose}
//                 disabled={sending}
//                 style={{
//                   background: '#f0f2f5', border: '1px solid #e9edef',
//                   borderRadius: '8px', padding: '10px 20px',
//                   fontSize: '14px', fontWeight: 500,
//                   cursor: sending ? 'not-allowed' : 'pointer', color: '#3b4a54',
//                 }}
//               >Cancel</button>
//               <button
//                 type="button"
//                 onClick={handleSend}
//                 disabled={sending || !to.trim() || !subject.trim() || !body.trim()}
//                 style={{
//                   background: sending || !to.trim() || !subject.trim() || !body.trim()
//                     ? 'rgba(0,168,132,0.45)' : '#00a884',
//                   border: 'none', borderRadius: '8px',
//                   padding: '10px 24px', fontSize: '14px',
//                   fontWeight: 600, cursor: sending ? 'not-allowed' : 'pointer',
//                   color: '#fff', display: 'flex', alignItems: 'center', gap: '8px',
//                   boxShadow: '0 2px 6px rgba(0,168,132,0.3)',
//                 }}
//               >
//                 {sending ? <>⏳ Sending…</> : <>✉️ Send Email</>}
//               </button>
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

// // ============ BLACKLIST MODAL ============
// function BlacklistModal({ conversation, storeName, onClose, onConfirm }) {
//   const customerEmail = conversation?.customerEmail || '';
//   const customerName = conversation?.customerName || 'Customer';

//   // 'store' = current store only | 'all' = all stores
//   const [scope, setScope] = useState('store');
//   const [reason, setReason] = useState('');
//   const [confirming, setConfirming] = useState(false);
//   const [done, setDone] = useState(false);
//   const [error, setError] = useState('');

//   const handleConfirm = async () => {
//     setError('');
//     try {
//       setConfirming(true);
//       await onConfirm({
//         email: customerEmail,
//         conversationId: conversation?.id,   // ← add this line
//         storeIdentifier: conversation?.storeIdentifier,
//         allStores: scope === 'all',
//         reason: reason.trim(),
//         customerName,
//       });
//       setDone(true);
//     } catch (err) {
//       setError(err.message || 'Failed to blacklist. Please try again.');
//     } finally {
//       setConfirming(false);
//     }
//   };

//   const scopeStore = scope === 'store';
//   const accentColor = '#e53e3e';

//   return (
//     <div
//       style={{
//         position: 'fixed', inset: 0, zIndex: 10001,
//         background: 'rgba(11,20,26,0.6)',
//         display: 'flex', alignItems: 'center', justifyContent: 'center',
//         padding: '16px',
//       }}
//       onClick={onClose}
//     >
//       <div
//         style={{
//           background: '#fff',
//           borderRadius: '14px',
//           width: '100%',
//           maxWidth: '480px',
//           boxShadow: '0 12px 40px rgba(0,0,0,0.28)',
//           overflow: 'hidden',
//           display: 'flex',
//           flexDirection: 'column',
//           animation: 'modalSlideUp 0.22s ease',
//         }}
//         onClick={e => e.stopPropagation()}
//       >
//         {/* Header */}
//         <div style={{
//           background: accentColor,
//           padding: '16px 20px',
//           display: 'flex',
//           alignItems: 'center',
//           justifyContent: 'space-between',
//         }}>
//           <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
//             <span style={{ fontSize: '22px' }}>🚫</span>
//             <div>
//               <div style={{ color: '#fff', fontWeight: 700, fontSize: '15px' }}>Blacklist Customer</div>
//               <div style={{ color: 'rgba(255,255,255,0.82)', fontSize: '12px' }}>{customerName}</div>
//             </div>
//           </div>
//           <button
//             type="button"
//             onClick={onClose}
//             style={{
//               background: 'rgba(255,255,255,0.2)', border: 'none',
//               borderRadius: '50%', width: '30px', height: '30px',
//               cursor: 'pointer', color: '#fff', fontSize: '15px',
//               display: 'flex', alignItems: 'center', justifyContent: 'center',
//             }}
//           >✕</button>
//         </div>

//         {done ? (
//           <div style={{ padding: '40px 24px', textAlign: 'center' }}>
//             <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
//             <div style={{ fontSize: '17px', fontWeight: 700, color: '#111b21', marginBottom: '6px' }}>
//               Customer Blacklisted
//             </div>
//             <div style={{ fontSize: '13px', color: '#667781', marginBottom: '6px' }}>
//               <strong>{customerEmail || customerName}</strong> has been blacklisted
//             </div>
//             <div style={{ fontSize: '13px', color: '#667781', marginBottom: '24px' }}>
//               {scope === 'all'
//                 ? 'across all stores.'
//                 : <>from <strong>{storeName || conversation?.storeIdentifier || 'this store'}</strong> only.</>}
//             </div>
//             <button
//               type="button"
//               onClick={onClose}
//               style={{
//                 background: accentColor, color: '#fff', border: 'none',
//                 borderRadius: '8px', padding: '10px 28px',
//                 fontSize: '14px', fontWeight: 600, cursor: 'pointer',
//               }}
//             >Close</button>
//           </div>
//         ) : (
//           <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

//             {/* Customer info pill */}
//             <div style={{
//               background: '#fff5f5', border: '1px solid #fed7d7',
//               borderRadius: '10px', padding: '12px 14px',
//               display: 'flex', alignItems: 'center', gap: '10px',
//             }}>
//               <span style={{ fontSize: '20px' }}>👤</span>
//               <div style={{ minWidth: 0 }}>
//                 <div style={{ fontWeight: 600, fontSize: '14px', color: '#111b21', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
//                   {customerName}
//                 </div>
//                 <div style={{ fontSize: '12px', color: '#667781', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
//                   {customerEmail || 'No email on file'}
//                 </div>
//               </div>
//             </div>

//             {/* Scope selector */}
//             <div>
//               <div style={{ fontSize: '12px', fontWeight: 600, color: '#3b4a54', marginBottom: '10px' }}>
//                 Blacklist scope
//               </div>
//               <div style={{ display: 'flex', gap: '10px' }}>
//                 {/* Store only */}
//                 <button
//                   type="button"
//                   onClick={() => setScope('store')}
//                   style={{
//                     flex: 1, padding: '12px 10px',
//                     border: `2px solid ${scopeStore ? accentColor : '#e9edef'}`,
//                     borderRadius: '10px',
//                     background: scopeStore ? '#fff5f5' : '#f9fafb',
//                     cursor: 'pointer', textAlign: 'left',
//                     transition: 'all 0.15s',
//                     outline: 'none',
//                   }}
//                 >
//                   <div style={{ fontSize: '20px', marginBottom: '4px' }}>🏪</div>
//                   <div style={{ fontSize: '13px', fontWeight: 600, color: scopeStore ? accentColor : '#111b21' }}>
//                     This store only
//                   </div>
//                   <div style={{ fontSize: '11px', color: '#667781', marginTop: '2px', lineHeight: '1.4' }}>
//                     {storeName || conversation?.storeIdentifier || 'Current store'}
//                   </div>
//                 </button>

//                 {/* All stores */}
//                 <button
//                   type="button"
//                   onClick={() => setScope('all')}
//                   style={{
//                     flex: 1, padding: '12px 10px',
//                     border: `2px solid ${!scopeStore ? accentColor : '#e9edef'}`,
//                     borderRadius: '10px',
//                     background: !scopeStore ? '#fff5f5' : '#f9fafb',
//                     cursor: 'pointer', textAlign: 'left',
//                     transition: 'all 0.15s',
//                     outline: 'none',
//                   }}
//                 >
//                   <div style={{ fontSize: '20px', marginBottom: '4px' }}>🌐</div>
//                   <div style={{ fontSize: '13px', fontWeight: 600, color: !scopeStore ? accentColor : '#111b21' }}>
//                     All stores
//                   </div>
//                   <div style={{ fontSize: '11px', color: '#667781', marginTop: '2px', lineHeight: '1.4' }}>
//                     Block network-wide
//                   </div>
//                 </button>
//               </div>
//             </div>

//             {/* Reason (optional) */}
//             <div>
//               <label style={{ fontSize: '12px', fontWeight: 600, color: '#3b4a54', display: 'block', marginBottom: '5px' }}>
//                 Reason <span style={{ fontWeight: 400, color: '#aab8c2' }}>(optional)</span>
//               </label>
//               <textarea
//                 value={reason}
//                 onChange={e => setReason(e.target.value)}
//                 placeholder="e.g. Repeated chargebacks, abusive behaviour…"
//                 rows={3}
//                 style={{
//                   width: '100%', padding: '9px 12px',
//                   border: '1.5px solid #e9edef', borderRadius: '8px',
//                   fontSize: '13px', color: '#111b21', outline: 'none',
//                   boxSizing: 'border-box', background: '#f9fafb',
//                   resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5',
//                   transition: 'border-color 0.15s',
//                 }}
//                 onFocus={e => e.target.style.borderColor = accentColor}
//                 onBlur={e => e.target.style.borderColor = '#e9edef'}
//               />
//             </div>

//             {/* Warning */}
//             <div style={{
//               background: '#fffbeb', border: '1px solid #f6e05e',
//               borderRadius: '8px', padding: '10px 14px',
//               fontSize: '12px', color: '#744210',
//               display: 'flex', gap: '8px', alignItems: 'flex-start',
//             }}>
//               <span style={{ flexShrink: 0, marginTop: '1px' }}>⚠️</span>
//               <span>
//                 {scope === 'all'
//                   ? 'This will block the customer from contacting support across every store in your network.'
//                   : `This will block the customer from contacting support on ${storeName || 'this store'} only.`}
//                 {' '}This action can be undone from the Blacklist Manager.
//               </span>
//             </div>

//             {error && (
//               <div style={{
//                 background: '#fff5f5', border: '1px solid #fed7d7',
//                 borderRadius: '8px', padding: '10px 14px',
//                 fontSize: '13px', color: '#c53030',
//               }}>
//                 ⚠️ {error}
//               </div>
//             )}

//             <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '2px' }}>
//               <button
//                 type="button"
//                 onClick={onClose}
//                 disabled={confirming}
//                 style={{
//                   background: '#f0f2f5', border: '1px solid #e9edef',
//                   borderRadius: '8px', padding: '10px 20px',
//                   fontSize: '14px', fontWeight: 500,
//                   cursor: confirming ? 'not-allowed' : 'pointer', color: '#3b4a54',
//                 }}
//               >Cancel</button>
//               <button
//                 type="button"
//                 onClick={handleConfirm}
//                 disabled={confirming}
//                 style={{
//                   background: confirming ? 'rgba(229,62,62,0.45)' : accentColor,
//                   border: 'none', borderRadius: '8px',
//                   padding: '10px 24px', fontSize: '14px',
//                   fontWeight: 600, cursor: confirming ? 'not-allowed' : 'pointer',
//                   color: '#fff', display: 'flex', alignItems: 'center', gap: '8px',
//                   boxShadow: '0 2px 6px rgba(229,62,62,0.3)',
//                 }}
//               >
//                 {confirming ? <>⏳ Blacklisting…</> : <>🚫 Blacklist Customer</>}
//               </button>
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

// // ============ ARCHIVE MODAL ============
// function ArchiveModal({ conversation, storeName, onClose, onConfirm }) {
//   const [archiving, setArchiving] = useState(false);
//   const [error, setError] = useState('');

//   const handleConfirm = async () => {
//     setError('');
//     try {
//       setArchiving(true);
//       await onConfirm();
//       onClose();
//     } catch (err) {
//       setError(err.message || 'Failed to archive. Please try again.');
//       setArchiving(false);
//     }
//   };

//   return (
//     <div
//       style={{
//         position: 'fixed', inset: 0, zIndex: 10001,
//         background: 'rgba(11,20,26,0.55)',
//         display: 'flex', alignItems: 'center', justifyContent: 'center',
//         padding: '16px',
//       }}
//       onClick={onClose}
//     >
//       <div
//         style={{
//           background: '#fff', borderRadius: '14px',
//           width: '100%', maxWidth: '420px',
//           boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
//           overflow: 'hidden',
//           animation: 'modalSlideUp 0.22s ease',
//         }}
//         onClick={e => e.stopPropagation()}
//       >
//         <div style={{
//           background: '#6366f1', padding: '16px 20px',
//           display: 'flex', alignItems: 'center', justifyContent: 'space-between',
//         }}>
//           <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
//             <span style={{ fontSize: '22px' }}>📦</span>
//             <div>
//               <div style={{ color: '#fff', fontWeight: 700, fontSize: '15px' }}>Archive Conversation</div>
//               <div style={{ color: 'rgba(255,255,255,0.82)', fontSize: '12px' }}>
//                 {conversation?.customerName || 'Customer'} · {storeName || conversation?.storeIdentifier}
//               </div>
//             </div>
//           </div>
//           <button
//             type="button" onClick={onClose}
//             style={{
//               background: 'rgba(255,255,255,0.2)', border: 'none',
//               borderRadius: '50%', width: '30px', height: '30px',
//               cursor: 'pointer', color: '#fff', fontSize: '15px',
//               display: 'flex', alignItems: 'center', justifyContent: 'center',
//             }}
//           >✕</button>
//         </div>

//         <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
//           <p style={{ margin: 0, fontSize: '14px', color: '#3b4a54', lineHeight: '1.6' }}>
//             This conversation will be moved to the <strong>Archive</strong>. It won't appear in the
//             active inbox but remains fully searchable and can be restored at any time.
//           </p>

//           <div style={{
//             background: '#f0f0ff', border: '1px solid #c7d2fe',
//             borderRadius: '8px', padding: '10px 14px',
//             fontSize: '12px', color: '#3730a3',
//             display: 'flex', gap: '8px', alignItems: 'flex-start',
//           }}>
//             <span style={{ flexShrink: 0 }}>ℹ️</span>
//             <span>Unlike Delete, archived conversations are never permanently removed.</span>
//           </div>

//           {error && (
//             <div style={{
//               background: '#fff5f5', border: '1px solid #fed7d7',
//               borderRadius: '8px', padding: '10px 14px',
//               fontSize: '13px', color: '#c53030',
//             }}>
//               ⚠️ {error}
//             </div>
//           )}

//           <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
//             <button
//               type="button" onClick={onClose} disabled={archiving}
//               style={{
//                 background: '#f0f2f5', border: '1px solid #e9edef',
//                 borderRadius: '8px', padding: '10px 20px',
//                 fontSize: '14px', fontWeight: 500,
//                 cursor: archiving ? 'not-allowed' : 'pointer', color: '#3b4a54',
//               }}
//             >Cancel</button>
//             <button
//               type="button" onClick={handleConfirm} disabled={archiving}
//               style={{
//                 background: archiving ? 'rgba(99,102,241,0.45)' : '#6366f1',
//                 border: 'none', borderRadius: '8px',
//                 padding: '10px 24px', fontSize: '14px',
//                 fontWeight: 600, cursor: archiving ? 'not-allowed' : 'pointer',
//                 color: '#fff', display: 'flex', alignItems: 'center', gap: '8px',
//                 boxShadow: '0 2px 6px rgba(99,102,241,0.3)',
//               }}
//             >
//               {archiving ? <>⏳ Archiving…</> : <>📦 Archive</>}
//             </button>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// // ============ HELPER: parse fileData safely ============
// const parseFileData = (raw) => {
//   if (!raw) return null;
//   if (typeof raw === 'object') return raw;
//   try { return JSON.parse(raw); } catch { return null; }
// };

// // ============ HELPER: normalize messages from server ============
// const normalizeMessage = (msg) => ({
//   ...msg,
//   fileData: parseFileData(msg.fileData || msg.file_data),
// });

// // ============ SHARED INPUT STYLE ============
// const INPUT_STYLE = {
//   fontSize:     '14px',
//   lineHeight:   '1.5',
//   fontFamily:   'inherit',
//   padding:      '9px 12px',
//   whiteSpace:   'pre-wrap',
//   wordBreak:    'break-word',
//   overflowWrap: 'break-word',
// };


// function ActionsDropdown({
//   conversation, onSendEmail, onMarkAsUnread,
//   onArchive, onBlacklist, onCustomerInfo, onDelete,
// }) {
//   const [open, setOpen] = React.useState(false);
//   const ref = React.useRef(null);
 
//   React.useEffect(() => {
//     const handler = (e) => {
//       if (ref.current && !ref.current.contains(e.target)) setOpen(false);
//     };
//     if (open) document.addEventListener('mousedown', handler);
//     return () => document.removeEventListener('mousedown', handler);
//   }, [open]);
 
//   const item = (icon, label, onClick, danger = false) => (
//     <button
//       type="button"
//       onClick={() => { onClick(); setOpen(false); }}
//       style={{
//         width: '100%', textAlign: 'left', padding: '9px 14px',
//         border: 'none', background: 'none', cursor: 'pointer',
//         display: 'flex', alignItems: 'center', gap: '10px',
//         fontSize: '13.5px', fontWeight: 500,
//         color: danger ? '#e53e3e' : '#111b21',
//         transition: 'background 0.1s',
//         fontFamily: 'inherit',
//       }}
//       onMouseEnter={e => e.currentTarget.style.background = danger ? '#fff5f5' : '#f0f2f5'}
//       onMouseLeave={e => e.currentTarget.style.background = 'none'}
//     >
//       <span style={{ fontSize: '16px', width: '20px', textAlign: 'center', flexShrink: 0 }}>{icon}</span>
//       {label}
//     </button>
//   );
 
//   const divider = () => (
//     <div style={{ height: '1px', background: '#e9edef', margin: '3px 0' }} />
//   );
 
//   return (
//     <div ref={ref} style={{ position: 'relative' }}>
//       {/* Trigger — styled for the WHITE chat header, not the green app header */}
//       <button
//         type="button"
//         onClick={() => setOpen(v => !v)}
//         style={{
//           display: 'flex', alignItems: 'center', gap: '6px',
//           padding: '6px 12px', border: '1px solid #e9edef',
//           borderRadius: '8px', cursor: 'pointer',
//           background: open ? '#f0f2f5' : '#fff',
//           color: '#3b4a54',
//           fontSize: '13px', fontWeight: 600,
//           transition: 'background 0.15s, border-color 0.15s',
//           fontFamily: 'inherit',
//           boxShadow: open ? 'none' : '0 1px 2px rgba(11,20,26,0.06)',
//         }}
//         onMouseEnter={e => {
//           if (!open) {
//             e.currentTarget.style.background = '#f0f2f5';
//             e.currentTarget.style.borderColor = '#d1d7db';
//           }
//         }}
//         onMouseLeave={e => {
//           if (!open) {
//             e.currentTarget.style.background = '#fff';
//             e.currentTarget.style.borderColor = '#e9edef';
//           }
//         }}
//         title="Actions"
//       >
//         Actions
//         <span style={{
//           fontSize: '10px', color: '#8696a0',
//           transform: open ? 'rotate(180deg)' : 'none',
//           transition: 'transform 0.2s', display: 'inline-block',
//         }}>▾</span>
//       </button>
 
//       {open && (
//         <div style={{
//           position: 'absolute', top: 'calc(100% + 6px)', right: 0,
//           minWidth: '210px', background: '#fff',
//           border: '1px solid rgba(0,0,0,0.08)', borderRadius: '12px',
//           boxShadow: '0 4px 6px rgba(11,20,26,0.07), 0 12px 28px rgba(11,20,26,0.13)',
//           zIndex: 1000, overflow: 'hidden', padding: '5px 0',
//           animation: 'actionsDropIn 0.14s cubic-bezier(0.34,1.56,0.64,1)',
//         }}>
//           {item('✉️', conversation?.customerEmail ? `Email ${conversation.customerEmail.split('@')[0]}` : 'Send Email', onSendEmail)}
//           {onMarkAsUnread && item('🔵', 'Mark as Unread', onMarkAsUnread)}
//           {divider()}
//           {item('📦', 'Archive', onArchive)}
//           {divider()}
//           {item('🚫', 'Blacklist Customer', onBlacklist, true)}
//           {item('🗑️', 'Delete Conversation', onDelete, true)}
//         </div>
//       )}
 
//       <style>{`
//         @keyframes actionsDropIn {
//           from { opacity: 0; transform: scale(0.93) translateY(-4px); }
//           to   { opacity: 1; transform: scale(1) translateY(0); }
//         }
//       `}</style>
//     </div>
//   );
// }

// // ============ MAIN COMPONENT ============
// function ChatWindow({
//   conversation,
//   onSendMessage,
//   onClose,
//   onTyping,
//   employeeName,
//   onMenuToggle,
//   stores,
//   isAdmin = false,
//   onMarkAsUnread,
//   onArchive,        // NEW: (conversationId) => Promise<void>
//   onBlacklist,      // NEW: ({ email, storeIdentifier, allStores, reason, customerName }) => Promise<void>
// }) {
//   const [messages, setMessages] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [messageText, setMessageText] = useState('');
//   const [sending, setSending] = useState(false);
//   const [typingUsers, setTypingUsers] = useState(new Set());
//   const [showCustomerInfo, setShowCustomerInfo] = useState(false);
//   const [wsConnected, setWsConnected] = useState(false);
//   const [showDeleteModal, setShowDeleteModal] = useState(false);
//   const [deleting, setDeleting] = useState(false);
//   const [showAISuggestions, setShowAISuggestions] = useState(true);

//   // Mark as unread toast
//   const [unreadToast, setUnreadToast] = useState(false);
//   const unreadToastTimerRef = useRef(null);

//   // Message delete state
//   const [messageToDelete, setMessageToDelete] = useState(null);
//   const [deletingMessage, setDeletingMessage] = useState(false);

//   // File upload states
//   const [selectedFile, setSelectedFile] = useState(null);
//   const [filePreview, setFilePreview] = useState(null);
//   const [uploading, setUploading] = useState(false);
//   const [uploadProgress, setUploadProgress] = useState(0);

//   // Emoji picker state
//   const [showEmojiPicker, setShowEmojiPicker] = useState(false);

//   // Template / Quick Reply states
//   const [templates, setTemplates] = useState([]);
//   const [templateLoading, setTemplateLoading] = useState(false);
//   const [showQuickReplies, setShowQuickReplies] = useState(false);

//   // Send email state
//   const [showEmailModal, setShowEmailModal] = useState(false);

//   // ── NEW: Blacklist + Archive state ──────────────────────────────
//   const [showBlacklistModal, setShowBlacklistModal] = useState(false);
//   const [showArchiveModal, setShowArchiveModal]     = useState(false);
//   // ────────────────────────────────────────────────────────────────

//   // Legal threat state
//   const [legalAlert, setLegalAlert] = useState(null);
//   const legalDismissTimerRef = useRef(null);

//   const autoReplyTimerRef = useRef(null);
//   const AUTO_REPLY_DELAY_MS = 3 * 60 * 1000; // 3 minutes
//   const AUTO_REPLY_TEXT =
//   'We received your message and will answer you ASAP! We answer as early as next business day, sometimes even within a few hours!';

//   const messagesEndRef = useRef(null);
//   const editableRef = useRef(null);
//   const fileInputRef = useRef(null);
//   const typingTimeoutRef = useRef(null);
//   const wsRef = useRef(null);
//   const displayedMessageIds = useRef(new Set());
//   const reconnectTimeoutRef = useRef(null);
//   const reconnectAttempts = useRef(0);
//   const maxReconnectAttempts = 5;
//   const hasAuthenticated = useRef(false);
//   const hasJoined = useRef(false);
//   const activeNotificationsRef = useRef(new Map());
//   const pollIntervalRef = useRef(null);

//   const conversationRef = useRef(conversation);
//   const employeeNameRef = useRef(employeeName);
//   const handleWsMessageRef = useRef(null);

//   useEffect(() => { loadTemplates(); }, []);
//   useEffect(() => { conversationRef.current = conversation; }, [conversation]);
//   useEffect(() => { employeeNameRef.current = employeeName; }, [employeeName]);

//   useEffect(() => {
//     return () => {
//       if (legalDismissTimerRef.current) clearTimeout(legalDismissTimerRef.current);
//       if (unreadToastTimerRef.current) clearTimeout(unreadToastTimerRef.current);
//     };
//   }, []);

//   // ============ WYSIWYG HELPERS ============
//   const htmlToMarkdown = (html) => {
//     if (!html) return '';
//     return html
//       .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
//       .replace(/<b>(.*?)<\/b>/gi, '**$1**')
//       .replace(/<em>(.*?)<\/em>/gi, '*$1*')
//       .replace(/<i>(.*?)<\/i>/gi, '*$1*')
//       .replace(/<s>(.*?)<\/s>/gi, '~~$1~~')
//       .replace(/<strike>(.*?)<\/strike>/gi, '~~$1~~')
//       .replace(/<code>(.*?)<\/code>/gi, '`$1`')
//       .replace(/<br\s*\/?>/gi, '\n')
//       .replace(/&amp;/g, '&')
//       .replace(/&lt;/g, '<')
//       .replace(/&gt;/g, '>')
//       .replace(/<[^>]+>/g, '')
//       .trim();
//   };

//   const getMessageContent = () => htmlToMarkdown(editableRef.current?.innerHTML || '');

//   const clearInput = () => {
//     if (editableRef.current) editableRef.current.innerHTML = '';
//     setMessageText('');
//   };

//   const setInputContent = (text) => {
//     if (editableRef.current) {
//       editableRef.current.innerHTML = parseMarkdown(text);
//       const range = document.createRange();
//       const sel = window.getSelection();
//       range.selectNodeContents(editableRef.current);
//       range.collapse(false);
//       sel.removeAllRanges();
//       sel.addRange(range);
//       editableRef.current.focus();
//     }
//     setMessageText(text);
//   };

//   // ============ TEMPLATE / SUGGESTION HANDLERS ============
//   const loadTemplates = async () => {
//     try {
//       const data = await api.getTemplates();
//       setTemplates(Array.isArray(data) ? data : []);
//     } catch (error) {
//       console.error('Failed to load templates:', error);
//       setTemplates([]);
//     }
//   };

//   const handleSendEmail = async ({ to, subject, body }) => {
//     await api.sendEmail({
//       to,
//       subject,
//       body,
//       conversationId: conversation?.id,
//       customerName: conversation?.customerName,
//     });
//   };

//   const handleMarkAsUnread = () => {
//     if (!onMarkAsUnread || !conversation?.id) return;
//     onMarkAsUnread(conversation.id);
//     setUnreadToast(true);
//     if (unreadToastTimerRef.current) clearTimeout(unreadToastTimerRef.current);
//     unreadToastTimerRef.current = setTimeout(() => setUnreadToast(false), 2500);
//   };

//   const handleUseTemplate = (content) => { setInputContent(content); };

//   const handleAddQuickReply = async ({ name, content }) => {
//     const newTemplate = await api.createTemplate({ name, content });
//     setTemplates(prev => [...prev, newTemplate]);
//   };

//   const handleSaveQuickReply = async (templateId, { name, content }) => {
//     const updated = await api.updateTemplate(templateId, { name, content });
//     setTemplates(prev => prev.map(t => t.id === templateId ? updated : t));
//   };

//   const handleDeleteQuickReply = async (templateId) => {
//     await api.deleteTemplate(templateId);
//     setTemplates(prev => prev.filter(t => t.id !== templateId));
//   };

//   const handleSelectSuggestion = (suggestion) => { setInputContent(suggestion); };

//   // ============ EMOJI HANDLER ============
//   const handleEmojiSelect = (emoji) => {
//     if (editableRef.current) {
//       editableRef.current.focus();
//       document.execCommand('insertText', false, emoji);
//       setMessageText(editableRef.current.innerText);
//     }
//   };

//   // ============ MESSAGE DELETE HANDLERS ============
//   const handleDeleteMessageClick = (message) => { setMessageToDelete(message); };
//   const handleCancelMessageDelete = () => { setMessageToDelete(null); };

//   const handleConfirmMessageDelete = async () => {
//     if (!messageToDelete) return;
//     try {
//       setDeletingMessage(true);
//       await api.deleteMessage(messageToDelete.id);
//       displayedMessageIds.current.delete(String(messageToDelete.id));
//       setMessages(prev => prev.filter(m => String(m.id) !== String(messageToDelete.id)));
//       setMessageToDelete(null);
//     } catch (error) {
//       console.error('Failed to delete message:', error);
//       alert(`Failed to delete message: ${error.message}`);
//     } finally {
//       setDeletingMessage(false);
//     }
//   };

//   // ============ ARCHIVE HANDLER ============
//   const handleConfirmArchive = async () => {
//     if (onArchive) {
//       await onArchive(conversation.id);
//     } else {
//       await api.archiveConversation(conversation.id);
//     }
//     setShowArchiveModal(false);
//     if (onClose) onClose();
//   };

//   // ============ BLACKLIST HANDLER ============
//   const handleConfirmBlacklist = async (payload) => {
//     if (onBlacklist) {
//       await onBlacklist(payload);
//     } else {
//       await api.blacklistCustomer(payload);
//     }
//   };

//   // ============ FILE HANDLING ============
//   const handleAttachClick = () => { if (fileInputRef.current) fileInputRef.current.click(); };

//   const handleFileSelect = async (e) => {
//     let file = e.target.files[0];
//     if (!file) return;
//     const maxSize = 10 * 1024 * 1024;
//     const isHeic = file.type === 'image/heic' || file.type === 'image/heif'
//       || /\.(heic|heif)$/i.test(file.name);
//     if (isHeic) {
//       try {
//         const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 });
//         file = new File([blob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
//       } catch (err) {
//         console.error('HEIC conversion failed:', err);
//         alert('Could not convert HEIC image. Please export it as JPEG first.');
//         return;
//       }
//     }
//     if (file.size > maxSize) { alert('File size must be less than 10MB'); return; }
//     setSelectedFile(file);
//     if (file.type.startsWith('image/')) {
//       const reader = new FileReader();
//       reader.onload = (e) => setFilePreview({ type: 'image', url: e.target.result, name: file.name });
//       reader.readAsDataURL(file);
//     } else {
//       setFilePreview({ type: 'file', name: file.name, size: formatFileSize(file.size) });
//     }
//   };

//   const handlePaste = async (e) => {
//     const items = Array.from(e.clipboardData?.items || []);
//     if (!items.length) return;

//     const plainText = e.clipboardData.getData('text/plain') || '';
//     if (/file:\/\/[^\s]*\.hei[cf]/i.test(plainText.trim())) {
//       e.preventDefault();
//       alert('HEIC images cannot be pasted directly. Please share the photo as JPEG instead.');
//       return;
//     }

//     for (const item of items) {
//       if (!item.type.startsWith('image/')) continue;
//       e.preventDefault();
//       let file = item.getAsFile();
//       if (!file) continue;
//       const maxSize = 10 * 1024 * 1024;
//       if (file.size > maxSize) { alert('Pasted image must be less than 10MB'); return; }
//       const isHeic = file.type === 'image/heic' || file.type === 'image/heif'
//         || /\.hei[cf]$/i.test(file.name);
//       if (isHeic) {
//         try {
//           const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 });
//           file = new File([blob], `screenshot-${Date.now()}.jpg`, { type: 'image/jpeg' });
//         } catch (err) {
//           console.error('HEIC conversion failed:', err);
//           alert('Could not convert HEIC image. Please share the photo as JPEG instead.');
//           return;
//         }
//       }
//       const ext = file.type.split('/')[1] || 'png';
//       const namedFile = new File([file], `screenshot-${Date.now()}.${ext}`, { type: file.type });
//       setSelectedFile(namedFile);
//       const reader = new FileReader();
//       reader.onload = (ev) => setFilePreview({ type: 'image', url: ev.target.result, name: namedFile.name });
//       reader.readAsDataURL(namedFile);
//       break;
//     }
//   };

//   const handleRemoveFile = () => {
//     setSelectedFile(null);
//     setFilePreview(null);
//     if (fileInputRef.current) fileInputRef.current.value = '';
//   };

//   const formatFileSize = (bytes) => {
//     if (bytes === 0) return '0 Bytes';
//     const k = 1024;
//     const sizes = ['Bytes', 'KB', 'MB', 'GB'];
//     const i = Math.floor(Math.log(bytes) / Math.log(k));
//     return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
//   };

//   const uploadFileToBunny = async (file) => {
//     try {
//       setUploading(true);
//       setUploadProgress(0);
//       const formData = new FormData();
//       formData.append('file', file);
//       const response = await api.uploadFile(formData, (progressEvent) => {
//         setUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
//       });
//       return response;
//     } catch (error) {
//       console.error('❌ File upload failed:', error);
//       throw error;
//     } finally {
//       setUploading(false);
//       setUploadProgress(0);
//     }
//   };

//   // ============ WEBSOCKET ============
//   const getWsUrl = () => {
//     let baseUrl = api.baseUrl || import.meta.env.VITE_API_URL || '';
//     if (!baseUrl) baseUrl = window.location.origin;
//     baseUrl = baseUrl.replace(/\/$/, '');
//     return baseUrl.replace(/^http/, 'ws') + '/ws';
//   };

//   const connectWebSocket = () => {
//     disconnectWebSocket();
//     if (!conversationRef.current?.id) return;
//     const token = localStorage.getItem('token');
//     if (!token) { console.error('❌ [WS] No auth token found'); return; }
//     try {
//       const wsUrl = getWsUrl();
//       hasAuthenticated.current = false;
//       hasJoined.current = false;
//       const ws = new WebSocket(wsUrl);
//       wsRef.current = ws;
//       ws.onopen = () => {
//         reconnectAttempts.current = 0;
//         ws.send(JSON.stringify({ type: 'auth', token, clientType: 'agent' }));
//       };
//       ws.onmessage = (event) => {
//         try {
//           const data = JSON.parse(event.data);
//           if (handleWsMessageRef.current) handleWsMessageRef.current(data);
//         } catch (error) { console.error('❌ [WS] Parse error:', error); }
//       };
//       ws.onerror = () => setWsConnected(false);
//       ws.onclose = (event) => {
//         setWsConnected(false);
//         hasAuthenticated.current = false;
//         hasJoined.current = false;
//         wsRef.current = null;
//         if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts && conversationRef.current?.id) {
//           reconnectAttempts.current++;
//           const delay = Math.min(2000 * reconnectAttempts.current, 10000);
//           reconnectTimeoutRef.current = setTimeout(connectWebSocket, delay);
//         }
//       };
//     } catch (error) {
//       console.error('❌ [WS] Connection failed:', error);
//       setWsConnected(false);
//     }
//   };

//   const disconnectWebSocket = () => {
//     if (reconnectTimeoutRef.current) { clearTimeout(reconnectTimeoutRef.current); reconnectTimeoutRef.current = null; }
//     if (wsRef.current) {
//       const ws = wsRef.current;
//       wsRef.current = null;
//       hasAuthenticated.current = false;
//       hasJoined.current = false;
//       if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close(1000, 'Component unmounting');
//     }
//     setWsConnected(false);
//   };

//   // ============ LEGAL ALERT HELPERS ============
//   const showLegalAlert = (alert) => {
//     if (legalDismissTimerRef.current) clearTimeout(legalDismissTimerRef.current);
//     setLegalAlert(alert);
//     legalDismissTimerRef.current = setTimeout(() => setLegalAlert(null), 15000);
//   };

//   const dismissLegalAlert = () => {
//     if (legalDismissTimerRef.current) clearTimeout(legalDismissTimerRef.current);
//     setLegalAlert(null);
//   };

//   const handleWebSocketMessage = (data) => {
//     const currentConv = conversationRef.current;
//     const currentEmployeeName = employeeNameRef.current;

//     switch (data.type) {
//       case 'connected': break;

//       case 'auth_ok':
//         hasAuthenticated.current = true;
//         if (currentConv?.id && wsRef.current?.readyState === WebSocket.OPEN) {
//           wsRef.current.send(JSON.stringify({
//             type: 'join_conversation',
//             conversationId: parseInt(currentConv.id),
//             role: 'agent',
//             employeeName: currentEmployeeName || 'Agent'
//           }));
//         }
//         break;

//       case 'joined':
//         hasJoined.current = true;
//         setWsConnected(true);
//         break;

//       case 'new_message':
//         if (data.message) handleIncomingMessage(data.message, currentConv, currentEmployeeName);
//         break;

//       case 'message_confirmed':
//         if (data.tempId && data.message) {
//           const confirmedMsg = normalizeMessage(data.message);
//           setMessages(prev => prev.map(msg =>
//             String(msg.id) === String(data.tempId)
//               ? { ...confirmedMsg, fileData: confirmedMsg.fileData || msg.fileData, fileUrl: confirmedMsg.fileUrl || msg.fileUrl, sending: false, _optimistic: false }
//               : msg
//           ));
//           if (data.message.id) displayedMessageIds.current.add(String(data.message.id));
//         }
//         break;

//       case 'message_failed':
//         if (data.tempId) {
//           setMessages(prev => prev.map(msg =>
//             String(msg.id) === String(data.tempId)
//               ? { ...msg, sending: false, failed: true, _optimistic: false }
//               : msg
//           ));
//         }
//         break;

//       case 'message_deleted':
//         if (data.messageId) {
//           displayedMessageIds.current.delete(String(data.messageId));
//           setMessages(prev => prev.filter(m => String(m.id) !== String(data.messageId)));
//         }
//         break;

//       case 'legal_threat_detected': {
//         const alert = data.alert;
//         if (!alert) break;
//         console.warn(`🚨 [LEGAL] ${alert.severity?.toUpperCase()} — "${alert.matchedTerm}" in conv #${alert.conversationId}`);
//         playNotificationSound();
//         setTimeout(() => playNotificationSound(), 400);
//         if (String(alert.conversationId) === String(currentConv?.id)) {
//           showLegalAlert(alert);
//         } else {
//           if (Notification.permission === 'granted') {
//             const emoji = alert.severity === 'critical' ? '🚨' : alert.severity === 'high' ? '⚠️' : '🔔';
//             try {
//               const n = new Notification(`${emoji} Legal Threat — Conv #${alert.conversationId}`, {
//                 body: `${alert.severity?.toUpperCase()}: "${alert.matchedTerm}" from ${alert.senderName}`,
//                 icon: '/favicon.ico',
//                 requireInteraction: alert.severity === 'critical',
//                 tag: `legal-${alert.conversationId}`,
//               });
//               n.onclick = () => { window.focus(); n.close(); };
//               if (alert.severity !== 'critical') setTimeout(() => n.close(), 8000);
//             } catch (e) {}
//           }
//         }
//         break;
//       }

//       case 'typing': handleTypingIndicator(data); break;
//       case 'customer_left': setTypingUsers(new Set()); break;

//       case 'error':
//         console.error('❌ [WS] Server error:', data.message);
//         if (data.message?.includes('token') || data.message?.includes('auth')) {
//           hasAuthenticated.current = false;
//           hasJoined.current = false;
//           setWsConnected(false);
//         }
//         break;

//       default: break;
//     }
//   };

//   handleWsMessageRef.current = handleWebSocketMessage;

// const handleIncomingMessage = (message, currentConv, currentEmployeeName) => {
//     const msgId = message.id;
//     const convId = message.conversationId || message.conversation_id;
//     if (convId && String(convId) !== String(currentConv?.id)) { showNotification(message); return; }
//     if (msgId && displayedMessageIds.current.has(String(msgId))) return;
//     if (message.senderType === 'agent' && currentEmployeeName && message.senderName === currentEmployeeName) {
//       if (msgId) displayedMessageIds.current.add(String(msgId));
//       return;
//     }
//     if (msgId) displayedMessageIds.current.add(String(msgId));
//     const normalized = normalizeMessage(message);
//     setMessages(prev => {
//       if (prev.some(m => String(m.id) === String(msgId))) return prev;
//       return [...prev, { ...normalized, sending: false, _optimistic: false }];
//     });
//     if (message.senderType === 'customer') {
//       showNotification(message);

//       // Start (or reset) the 3-min auto-reply countdown
//       if (autoReplyTimerRef.current) clearTimeout(autoReplyTimerRef.current);
//       autoReplyTimerRef.current = setTimeout(async () => {
//         autoReplyTimerRef.current = null;
//         const currentConvSnap = conversationRef.current;
//         if (!currentConvSnap?.id) return;
//         try {
//           await onSendMessage(currentConvSnap, AUTO_REPLY_TEXT, null);
//         } catch (err) {
//           console.error('❌ Auto-reply failed:', err);
//         }
//       }, AUTO_REPLY_DELAY_MS);
//     }
//   };

  

//   const showNotification = (message) => {
//     if (!message || message.senderType === 'agent') return;
//     playNotificationSound();
//     if (Notification.permission === 'granted') createNotification(message);
//     else if (Notification.permission !== 'denied') Notification.requestPermission().then(p => { if (p === 'granted') createNotification(message); });
//   };

//   const createNotification = (message) => {
//     try {
//       const senderName = message.senderName || message.customerName || 'Customer';
//       const content = message.content || (message.fileData ? '📎 Sent a file' : 'New message');
//       const notification = new Notification(`New message from ${senderName}`, {
//         body: content.substring(0, 100),
//         icon: '/favicon.ico',
//         tag: `msg-${message.id || Date.now()}`,
//         requireInteraction: false
//       });
//       notification.onclick = () => { window.focus(); notification.close(); };
//       setTimeout(() => notification.close(), 5000);
//     } catch (error) { console.warn('Notification failed:', error); }
//   };

//   const clearAllNotifications = (conversationId) => {
//     const notifications = activeNotificationsRef.current.get(conversationId);
//     if (notifications) {
//       notifications.forEach(n => { try { n.close(); } catch (e) {} });
//       activeNotificationsRef.current.delete(conversationId);
//     }
//   };

//   const playNotificationSound = () => {
//     try {
//       const audioContext = new (window.AudioContext || window.webkitAudioContext)();
//       const oscillator = audioContext.createOscillator();
//       const gainNode = audioContext.createGain();
//       oscillator.connect(gainNode);
//       gainNode.connect(audioContext.destination);
//       oscillator.frequency.value = 800;
//       oscillator.type = 'sine';
//       gainNode.gain.value = 0.1;
//       oscillator.start();
//       gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
//       oscillator.stop(audioContext.currentTime + 0.3);
//     } catch (error) {}
//   };

//   const handleTypingIndicator = (data) => {
//     if (data.senderType === 'agent') return;
//     const senderName = data.senderName || 'Customer';
//     if (data.isTyping) {
//       setTypingUsers(prev => new Set([...prev, senderName]));
//       setTimeout(() => setTypingUsers(prev => {
//         const next = new Set(prev); next.delete(senderName); return next;
//       }), 5000);
//     } else {
//       setTypingUsers(prev => { const next = new Set(prev); next.delete(senderName); return next; });
//     }
//   };

//   const sendTypingIndicator = (isTyping) => {
//     if (wsRef.current?.readyState === WebSocket.OPEN && conversationRef.current?.id && hasJoined.current) {
//       wsRef.current.send(JSON.stringify({
//         type: 'typing',
//         conversationId: parseInt(conversationRef.current.id),
//         isTyping,
//         senderType: 'agent',
//         senderName: employeeNameRef.current || 'Agent'
//       }));
//     }
//   };

//   // ============ EFFECTS ============
//   useEffect(() => {
//     if (!conversation) { disconnectWebSocket(); return; }
//     connectWebSocket();
//     return () => disconnectWebSocket();
//   }, [conversation?.id, employeeName]);

//   useEffect(() => {
//     return () => { if (conversation?.id) clearAllNotifications(conversation.id); };
//   }, [conversation?.id]);

//   useEffect(() => {
//     if (conversation) { displayedMessageIds.current.clear(); loadMessages(); }
//     else { setMessages([]); setLoading(false); }
//     dismissLegalAlert();
//     setShowEmailModal(false);
//     setShowBlacklistModal(false);
//     setShowArchiveModal(false);
//     setUnreadToast(false);
//     clearInput();
//   }, [conversation?.id]);

//   useEffect(() => { scrollToBottom(); }, [messages]);

//   useEffect(() => {
//     const pingInterval = setInterval(() => {
//       if (wsRef.current?.readyState === WebSocket.OPEN) {
//         wsRef.current.send(JSON.stringify({ type: 'ping' }));
//       }
//     }, 30000);
//     return () => clearInterval(pingInterval);
//   }, []);

//   useEffect(() => {
//     if (!conversation?.id) { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); return; }
//     pollIntervalRef.current = setInterval(async () => {
//       try {
//         const data = await api.getMessages(conversation.id);
//         const serverMessages = (Array.isArray(data) ? data : []).map(normalizeMessage);
//         setMessages(prev => {
//           const existingIds = new Set(prev.map(m => String(m.id)));
//           const newMessages = serverMessages.filter(m => m.id && !existingIds.has(String(m.id)) && !displayedMessageIds.current.has(String(m.id)));
//           if (newMessages.length === 0) return prev;
//           newMessages.forEach(m => { if (m.id) displayedMessageIds.current.add(String(m.id)); });
//           let updated = prev.map(existing => {
//             if (!String(existing.id).startsWith('temp-')) return existing;
//             const confirmed = serverMessages.find(s =>
//               s.content === existing.content &&
//               s.senderType === existing.senderType &&
//               !existingIds.has(String(s.id))
//             );
//             if (confirmed) {
//               displayedMessageIds.current.add(String(confirmed.id));
//               return { ...confirmed, sending: false, _optimistic: false };
//             }
//             return existing;
//           });
//           return [...updated, ...newMessages.map(m => ({ ...m, sending: false, _optimistic: false }))];
//         });
//       } catch (error) {}
//     }, 5000);
//     return () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); };
//   }, [conversation?.id]);

//   useEffect(() => {
//     const handleGlobalPaste = (e) => {
//       const tag = document.activeElement?.tagName;
//       const isEditable = document.activeElement?.contentEditable === 'true';
//       if (tag === 'INPUT' || tag === 'TEXTAREA' || isEditable) return;
//       handlePaste(e);
//     };
//     window.addEventListener('paste', handleGlobalPaste);
//     return () => window.removeEventListener('paste', handleGlobalPaste);
//   }, [selectedFile]);

//   const loadMessages = async () => {
//     try {
//       setLoading(true);
//       const data = await api.getMessages(conversation.id);
//       const messageArray = (Array.isArray(data) ? data : []).map(normalizeMessage);
//       messageArray.forEach(msg => { if (msg.id) displayedMessageIds.current.add(String(msg.id)); });
//       setMessages(messageArray);
//     } catch (error) {
//       console.error('Failed to load messages:', error);
//       setMessages([]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); };

//   // ============ SEND ============
//   const handleSend = async (e) => {
//     if (e) { e.preventDefault(); e.stopPropagation(); }
//     const text = getMessageContent();
//     const hasText = text.length > 0;
//     const hasFile = selectedFile;
//     if ((!hasText && !hasFile) || sending || uploading) return;

//     try {
//       setSending(true);

//       if (autoReplyTimerRef.current) {
//         clearTimeout(autoReplyTimerRef.current);
//         autoReplyTimerRef.current = null;
//       }

//       let fileUrl = null;
//       let fileData = null;
//       if (selectedFile) {
//         const uploadResult = await uploadFileToBunny(selectedFile);
//         fileUrl = uploadResult.url;
//         fileData = { url: uploadResult.url, name: selectedFile.name, type: selectedFile.type, size: selectedFile.size };
//       }

//       clearInput();
//       handleRemoveFile();
//       setShowEmojiPicker(false);
//       sendTypingIndicator(false);

//       const optimisticMessage = {
//         id: `temp-${Date.now()}`,
//         conversationId: conversation.id,
//         senderType: 'agent',
//         senderName: employeeName || 'Agent',
//         content: text || '',
//         fileUrl,
//         fileData,
//         createdAt: new Date().toISOString(),
//         _optimistic: true,
//         sending: true,
//       };
//       setMessages(prev => [...prev, optimisticMessage]);
//       clearAllNotifications(conversation.id);

//       const sentMessage = await onSendMessage(conversation, text, fileData);
//       if (sentMessage.id) displayedMessageIds.current.add(String(sentMessage.id));
//       const normalizedSent = normalizeMessage(sentMessage);
//       const mergedMessage = {
//         ...normalizedSent,
//         fileUrl: normalizedSent.fileUrl || fileUrl,
//         fileData: normalizedSent.fileData || fileData,
//         sending: false,
//       };
//       setMessages(prev => prev.map(msg => msg._optimistic && msg.id === optimisticMessage.id ? mergedMessage : msg));
//     } catch (error) {
//       console.error('❌ Failed to send message:', error);
//       setMessages(prev => prev.filter(msg => !msg._optimistic));
//       setInputContent(text);
//       alert(`Failed to send message: ${error.message}`);
//     } finally {
//       setSending(false);
//     }
//   };

//   const handleDeleteClick = () => setShowDeleteModal(true);
//   const handleCancelDelete = () => setShowDeleteModal(false);

//   const handleConfirmDelete = async () => {
//     try {
//       setDeleting(true);
//       await api.closeConversation(conversation.id);
//       setShowDeleteModal(false);
//       if (onClose) onClose();
//     } catch (error) {
//       console.error('Failed to delete conversation:', error);
//       alert('Failed to delete conversation. Please try again.');
//     } finally {
//       setDeleting(false);
//     }
//   };

//   const handleBackClick = () => { if (onClose) onClose(); };

//   const getInitials = (name) => {
//     if (!name) return 'G';
//     return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
//   };

//   const getGroupedMessages = () => {
//     if (!messages || messages.length === 0) return [];
//     return messages.map((message, index) => {
//       const prevMessage = index > 0 ? messages[index - 1] : null;
//       const nextMessage = index < messages.length - 1 ? messages[index + 1] : null;
//       return {
//         ...message,
//         isFirstInGroup: !prevMessage || prevMessage.senderType !== message.senderType,
//         isLastInGroup: !nextMessage || nextMessage.senderType !== message.senderType,
//       };
//     });
//   };

//   const getStoreDetails = () => {
//     if (!stores || !conversation) return null;
//     return stores.find(s =>
//       s.storeIdentifier === conversation.storeIdentifier ||
//       s.id === conversation.shopId ||
//       s.id === conversation.shop_id ||
//       s.storeIdentifier === conversation.store_identifier
//     ) || null;
//   };

//   if (!conversation) {
//     return (
//       <div className="chat-window">
//         <div className="empty-state">
//           <div className="empty-state-icon">💬</div>
//           <h3>No conversation selected</h3>
//           <p>Select a conversation from the list to start chatting</p>
//         </div>
//       </div>
//     );
//   }

//   const storeDetails = getStoreDetails();
//   const storeName = storeDetails?.brandName || conversation.storeName || conversation.storeIdentifier;
//   const storeDomain = storeDetails?.domain || storeDetails?.url || storeDetails?.storeDomain || storeDetails?.shopDomain || storeDetails?.myshopify_domain || conversation.domain || conversation.storeDomain || null;
//   const groupedMessages = getGroupedMessages();

//   const legalBannerBg = legalAlert?.severity === 'critical' ? '#dc2626'
//     : legalAlert?.severity === 'high' ? '#d97706'
//     : '#2563eb';
//   const legalBannerEmoji = legalAlert?.severity === 'critical' ? '🚨'
//     : legalAlert?.severity === 'high' ? '⚠️'
//     : '🔔';

//   return (
//     <div className="chat-window" style={{ position: 'relative' }}>

//       {/* SEND EMAIL MODAL */}
//       {showEmailModal && (
//         <SendEmailModal
//           conversation={conversation}
//           onClose={() => setShowEmailModal(false)}
//           onSend={handleSendEmail}
//         />
//       )}

//       {/* BLACKLIST MODAL */}
//       {showBlacklistModal && (
//         <BlacklistModal
//           conversation={conversation}
//           storeName={storeName}
//           onClose={() => setShowBlacklistModal(false)}
//           onConfirm={handleConfirmBlacklist}
//         />
//       )}

//       {/* ARCHIVE MODAL */}
//       {showArchiveModal && (
//         <ArchiveModal
//           conversation={conversation}
//           storeName={storeName}
//           onClose={() => setShowArchiveModal(false)}
//           onConfirm={handleConfirmArchive}
//         />
//       )}

//       {/* LEGAL THREAT ALERT BANNER */}
//       {legalAlert && (
//         <div style={{
//           position: 'absolute', top: 0, left: 0, right: 0, zIndex: 9999,
//           background: legalBannerBg, color: 'white', padding: '10px 16px',
//           display: 'flex', alignItems: 'center', gap: '10px',
//           boxShadow: '0 2px 12px rgba(0,0,0,0.3)', animation: 'legalSlideDown 0.3s ease',
//         }}>
//           <span style={{ fontSize: '22px', flexShrink: 0 }}>{legalBannerEmoji}</span>
//           <div style={{ flex: 1, minWidth: 0 }}>
//             <div style={{ fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '2px' }}>
//               Legal Threat Detected — {legalAlert.severity?.toUpperCase()}
//               {legalAlert.fromAttachment && (
//                 <span style={{ marginLeft: '8px', background: 'rgba(255,255,255,0.2)', padding: '1px 6px', borderRadius: '4px', fontSize: '10px' }}>
//                   📎 FROM FILE
//                 </span>
//               )}
//             </div>
//             <div style={{ fontSize: '12px', opacity: 0.92, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
//               {legalAlert.documentType ? `Document: ${legalAlert.documentType}` : `Matched: "${legalAlert.matchedTerm}"`}
//               {legalAlert.snippet && (
//                 <span style={{ marginLeft: '8px', fontStyle: 'italic', opacity: 0.8 }}>
//                   · "{legalAlert.snippet.substring(0, 70)}{legalAlert.snippet.length > 70 ? '…' : ''}"
//                 </span>
//               )}
//             </div>
//           </div>
//           <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
//             <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.2)', padding: '3px 8px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
//               Priority → URGENT
//             </span>
//             <button
//               type="button" onClick={dismissLegalAlert} title="Dismiss"
//               style={{
//                 background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%',
//                 width: '26px', height: '26px', cursor: 'pointer', color: 'white',
//                 fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
//                 flexShrink: 0, transition: 'background 0.15s',
//               }}
//               onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.35)'}
//               onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
//             >✕</button>
//           </div>
//         </div>
//       )}

//       {/* MARK AS UNREAD TOAST */}
//       {unreadToast && (
//         <div style={{
//           position: 'absolute', top: legalAlert ? '66px' : '10px', left: '50%',
//           transform: 'translateX(-50%)', zIndex: 9998, background: '#111b21',
//           color: '#fff', fontSize: '13px', fontWeight: 500, padding: '8px 16px',
//           borderRadius: '20px', whiteSpace: 'nowrap', boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
//           animation: 'unreadToastIn 0.2s ease', pointerEvents: 'none',
//         }}>
//           🔵 Marked as unread
//         </div>
//       )}

//       {/* Header */}
//       <div className="chat-header" style={legalAlert ? { marginTop: '56px' } : {}}>
//         <div className="chat-header-left">
//           <button className="chat-back-btn-mobile" onClick={handleBackClick} aria-label="Back to conversations" type="button">←</button>
//           <div className="chat-header-avatar">{getInitials(conversation.customerName)}</div>
//           <div className="chat-header-info">
//             <h3>
//               {conversation.customerName || 'Guest'}
//               {conversation.legalFlag && (
//                 <span title={`Legal flag: ${conversation.legalFlagSeverity}`} style={{ marginLeft: '6px', fontSize: '14px' }}>
//                   {conversation.legalFlagSeverity === 'critical' ? '🚨' : '⚠️'}
//                 </span>
//               )}
//             </h3>
//             <div className="chat-header-subtitle">
//               {storeName && (
//                 <span className="store-info">
//                   <strong>{storeName}</strong>
//                   {storeDomain && ` • ${storeDomain}`}
//                 </span>
//               )}
//               <span className="customer-email-desktop">{storeName && ' • '}{conversation.customerEmail || 'No email'}</span>
//               <span
//                 style={{ color: wsConnected ? '#48bb78' : '#fc8181', marginLeft: '8px' }}
//                 title={wsConnected ? 'Connected' : 'Disconnected'}
//               >●</span>
//             </div>
//           </div>
//         </div>

//         <div className="chat-actions">
//           {/* AI Suggestions toggle — stays outside dropdown */}
//           <button
//             className="icon-btn"
//             onClick={() => setShowAISuggestions(!showAISuggestions)}
//             title={showAISuggestions ? 'Hide AI suggestions' : 'Show AI suggestions'}
//             type="button"
//             style={{ color: showAISuggestions ? '#00a884' : undefined, fontStyle: 'normal' }}
//           >✦</button>
 
//           <ActionsDropdown
//             conversation={conversation}
//             onSendEmail={() => setShowEmailModal(true)}
//             onMarkAsUnread={onMarkAsUnread ? handleMarkAsUnread : null}
//             onArchive={() => setShowArchiveModal(true)}
//             onBlacklist={() => setShowBlacklistModal(true)}
//             onCustomerInfo={() => setShowCustomerInfo(v => !v)}
//             onDelete={handleDeleteClick}
//           />
//         </div>
//       </div>

//       {/* Conversation Delete Modal */}
//       {showDeleteModal && (
//         <div className="modal-overlay" onClick={handleCancelDelete}>
//           <div className="modal-content delete-modal" onClick={e => e.stopPropagation()}>
//             <div className="modal-header"><h3>🗑️ Delete Conversation</h3></div>
//             <div className="modal-body">
//               <p>Are you sure you want to delete this conversation?</p>
//               <div className="delete-warning">
//                 <p><strong>Customer:</strong> {conversation.customerName || 'Guest'}</p>
//                 <p><strong>Store:</strong> {storeName}</p>
//                 <p className="warning-text">⚠️ This action cannot be undone. All messages will be permanently deleted.</p>
//               </div>
//             </div>
//             <div className="modal-footer">
//               <button className="btn-cancel" onClick={handleCancelDelete} disabled={deleting} type="button">Cancel</button>
//               <button className="btn-delete" onClick={handleConfirmDelete} disabled={deleting} type="button">{deleting ? 'Deleting...' : 'Yes, Delete'}</button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Message Delete Modal */}
//       {messageToDelete && (
//         <div className="modal-overlay" onClick={handleCancelMessageDelete}>
//           <div className="modal-content delete-modal" onClick={e => e.stopPropagation()}>
//             <div className="modal-header"><h3>🗑️ Delete Message</h3></div>
//             <div className="modal-body">
//               <p>Remove this message permanently?</p>
//               {messageToDelete.content && (
//                 <div className="delete-warning">
//                   <p style={{ fontStyle: 'italic', color: '#667781', marginTop: 4 }}>
//                     "{messageToDelete.content.length > 120 ? messageToDelete.content.slice(0, 120) + '…' : messageToDelete.content}"
//                   </p>
//                 </div>
//               )}
//               <p className="warning-text" style={{ marginTop: 8 }}>⚠️ This cannot be undone.</p>
//             </div>
//             <div className="modal-footer">
//               <button className="btn-cancel" onClick={handleCancelMessageDelete} disabled={deletingMessage} type="button">Cancel</button>
//               <button className="btn-delete" onClick={handleConfirmMessageDelete} disabled={deletingMessage} type="button">{deletingMessage ? 'Deleting...' : 'Delete'}</button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Content */}
//       <div className="chat-content" style={{ display: 'flex', flexDirection: 'row' }}>
//         <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
//           <div className="chat-messages" style={{ flex: 1 }}>
//             {loading ? (
//               <div className="empty-state"><div className="spinner"></div></div>
//             ) : messages.length === 0 ? (
//               <div className="empty-state">
//                 <div className="empty-state-icon">💬</div>
//                 <h3>No messages yet</h3>
//                 <p>Start the conversation by sending a message</p>
//               </div>
//             ) : (
//               <>
//                 {groupedMessages.map((message, index) => (
//                   <MessageBubble
//                     key={message.id || `msg-${index}`}
//                     message={message}
//                     nextMessage={index < groupedMessages.length - 1 ? groupedMessages[index + 1] : null}
//                     isAgent={message.senderType === 'agent'}
//                     isCustomer={message.senderType === 'customer'}
//                     showAvatar={true}
//                     isFirstInGroup={message.isFirstInGroup}
//                     isLastInGroup={message.isLastInGroup}
//                     sending={message.sending || message._optimistic}
//                     actionButton={
//                       isAdmin && !message._optimistic && message.senderType === 'agent' ? (
//                         <button
//                           type="button"
//                           onClick={() => handleDeleteMessageClick(message)}
//                           title="Delete message"
//                           style={{
//                             background: 'none', border: 'none', cursor: 'pointer',
//                             fontSize: 13, color: '#ccc', padding: 0, lineHeight: 1,
//                             transition: 'color 0.15s',
//                           }}
//                           onMouseEnter={e => e.currentTarget.style.color = '#e53e3e'}
//                           onMouseLeave={e => e.currentTarget.style.color = '#ccc'}
//                         >🗑️</button>
//                       ) : null
//                     }
//                   />
//                 ))}
//                 {typingUsers.size > 0 && (
//                   <div className="typing-indicator">
//                     <div className="typing-indicator-avatar">{getInitials(Array.from(typingUsers)[0])}</div>
//                     <div className="typing-indicator-bubble">
//                       <div className="typing-dot"></div>
//                       <div className="typing-dot"></div>
//                       <div className="typing-dot"></div>
//                     </div>
//                   </div>
//                 )}
//                 <div ref={messagesEndRef} />
//               </>
//             )}
//           </div>

//           {showCustomerInfo && (
//             <CustomerInfo
//               conversation={conversation}
//               onClose={() => setShowCustomerInfo(false)}
//               stores={stores}
//             />
//           )}
//         </div>

//         {showAISuggestions && (
//           <AISuggestions
//             conversation={conversation}
//             messages={messages}
//             onSelectSuggestion={handleSelectSuggestion}
//           />
//         )}
//       </div>

//       {/* File Preview */}
//       {filePreview && (
//         <div style={{
//           padding: '12px 16px', backgroundColor: '#f5f6f6',
//           borderTop: '1px solid #e9edef', display: 'flex', alignItems: 'center', gap: '12px',
//         }}>
//           {filePreview.type === 'image' ? (
//             <img src={filePreview.url} alt="Preview" style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px' }} />
//           ) : (
//             <div style={{ width: '60px', height: '60px', backgroundColor: '#00a884', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>📎</div>
//           )}
//           <div style={{ flex: 1, minWidth: 0 }}>
//             <div style={{ fontSize: '14px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{filePreview.name}</div>
//             {filePreview.size && <div style={{ fontSize: '12px', color: '#667781' }}>{filePreview.size}</div>}
//           </div>
//           {uploading && <div style={{ fontSize: '12px', color: '#00a884' }}>{uploadProgress}%</div>}
//           <button
//             onClick={handleRemoveFile} disabled={uploading} type="button"
//             style={{ background: 'none', border: 'none', fontSize: '20px', cursor: uploading ? 'not-allowed' : 'pointer', color: '#667781', padding: '4px 8px' }}
//           >✕</button>
//         </div>
//       )}

//       {/* Quick Replies */}
//       <QuickReplies
//         templates={templates}
//         onUseTemplate={handleUseTemplate}
//         onAddTemplate={handleAddQuickReply}
//         onDeleteTemplate={handleDeleteQuickReply}
//         onSaveTemplate={handleSaveQuickReply}
//         loading={templateLoading}
//         isOpen={showQuickReplies}
//         onToggle={() => setShowQuickReplies(!showQuickReplies)}
//       />

//       {/* Input Bar */}
//       <div style={{
//         background: '#f0f2f5', padding: '12px 16px', borderTop: '1px solid #e9edef',
//         display: 'flex', alignItems: 'flex-end', gap: '8px',
//         flexShrink: 0, boxShadow: '0 -1px 2px rgba(11,20,26,0.05)', position: 'relative',
//       }}>
//         {/* Quick Replies Toggle */}
//         <button
//           type="button"
//           title="Quick replies"
//           onClick={e => { e.preventDefault(); e.stopPropagation(); setShowQuickReplies(!showQuickReplies); }}
//           style={{
//             width: '40px', height: '40px', minWidth: '40px', flexShrink: 0,
//             border: 'none', borderRadius: '50%', background: 'transparent',
//             cursor: 'pointer', display: 'flex', alignItems: 'center',
//             justifyContent: 'center', fontSize: '20px', padding: 0,
//             color: showQuickReplies ? '#00a884' : '#54656f',
//           }}
//         >⚡</button>

//         {/* WYSIWYG INPUT AREA */}
//         <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
//           {!messageText && (
//             <div style={{
//               position: 'absolute', top: 0, left: 0, right: 0,
//               padding: '9px 12px', fontSize: '14px', lineHeight: '1.5',
//               color: '#667781', pointerEvents: 'none', userSelect: 'none', zIndex: 1,
//             }}>
//               Type a message... (Ctrl+V to paste screenshot)
//             </div>
//           )}

//           <div
//             ref={editableRef}
//             contentEditable={!sending && !uploading}
//             suppressContentEditableWarning
//             onInput={() => {
//               const text = editableRef.current?.innerText || '';
//               setMessageText(text);
//               sendTypingIndicator(true);
//               if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
//               typingTimeoutRef.current = setTimeout(() => sendTypingIndicator(false), 2000);
//             }}
//             onKeyDown={(e) => {
//               if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); }
//             }}
//             onPaste={(e) => {
//               const items = Array.from(e.clipboardData?.items || []);
//               const hasImage = items.some(i => i.type.startsWith('image/'));
//               if (hasImage) { e.preventDefault(); handlePaste(e); return; }
//               e.preventDefault();
//               const text = e.clipboardData.getData('text/plain');
//               document.execCommand('insertText', false, text);
//             }}
//             style={{
//               ...INPUT_STYLE,
//               display: 'block',
//               minHeight: '38px',
//               maxHeight: '120px',
//               overflowY: 'auto',
//               outline: 'none',
//               color: '#111b21',
//               borderRadius: '8px',
//               border: '1px solid #e9edef',
//               background: '#fff',
//               boxSizing: 'border-box',
//               cursor: sending || uploading ? 'not-allowed' : 'text',
//               opacity: sending || uploading ? 0.6 : 1,
//             }}
//           />

//           <input
//             ref={fileInputRef}
//             type="file"
//             accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.heic,.heif"
//             onChange={handleFileSelect}
//             style={{ display: 'none' }}
//           />

//           {showEmojiPicker && (
//             <EmojiPicker onSelect={handleEmojiSelect} onClose={() => setShowEmojiPicker(false)} />
//           )}
//         </div>

//         {/* Emoji Button */}
//         <button
//           type="button" title="Emoji"
//           onClick={e => { e.preventDefault(); e.stopPropagation(); setShowEmojiPicker(v => !v); }}
//           style={{
//             width: '40px', height: '40px', minWidth: '40px', flexShrink: 0,
//             border: 'none', borderRadius: '50%', background: 'transparent',
//             cursor: 'pointer', display: 'flex', alignItems: 'center',
//             justifyContent: 'center', fontSize: '20px', padding: 0,
//             color: showEmojiPicker ? '#00a884' : '#54656f',
//           }}
//         >😊</button>

//         {/* Attach Button */}
//         <button
//           type="button" title="Attach file"
//           onClick={handleAttachClick} disabled={uploading}
//           style={{
//             width: '40px', height: '40px', minWidth: '40px', flexShrink: 0,
//             border: 'none', borderRadius: '50%', background: 'transparent',
//             cursor: uploading ? 'not-allowed' : 'pointer',
//             display: 'flex', alignItems: 'center',
//             justifyContent: 'center', fontSize: '20px', padding: 0,
//             color: '#54656f',
//           }}
//         >{uploading ? '⏳' : '📎'}</button>

//         {/* Send Button */}
//         <button
//           type="button" title="Send message (Enter)"
//           onClick={handleSend}
//           disabled={(!messageText.trim() && !selectedFile) || sending || uploading}
//           style={{
//             width: '44px', height: '44px', minWidth: '44px', flexShrink: 0,
//             border: 'none', borderRadius: '50%',
//             background: (!messageText.trim() && !selectedFile) || sending || uploading
//               ? 'rgba(0,168,132,0.4)' : '#00a884',
//             cursor: (!messageText.trim() && !selectedFile) || sending || uploading
//               ? 'not-allowed' : 'pointer',
//             display: 'flex', alignItems: 'center', justifyContent: 'center',
//             fontSize: '20px', padding: 0, color: 'white',
//             boxShadow: '0 2px 6px rgba(0,168,132,0.3)',
//           }}
//         >{sending ? '⏳' : '➤'}</button>
//       </div>

//       <style>{`
//         @keyframes legalSlideDown {
//           from { transform: translateY(-100%); opacity: 0; }
//           to   { transform: translateY(0);     opacity: 1; }
//         }
//         @keyframes unreadToastIn {
//           from { opacity: 0; transform: translateX(-50%) translateY(-6px); }
//           to   { opacity: 1; transform: translateX(-50%) translateY(0); }
//         }
//         @keyframes modalSlideUp {
//           from { opacity: 0; transform: translateY(16px); }
//           to   { opacity: 1; transform: translateY(0); }
//         }
//         [contenteditable]:empty:focus { outline: none; }
//         [contenteditable] strong { font-weight: 700; }
//         [contenteditable] em { font-style: italic; }
//         [contenteditable] s { text-decoration: line-through; }
//         [contenteditable] code {
//           background: rgba(0,0,0,0.08);
//           padding: 1px 5px;
//           border-radius: 4px;
//           font-size: 0.9em;
//           font-family: monospace;
//         }
//       `}</style>
//     </div>
//   );
// }

// export default ChatWindow;


import React, { useState, useEffect, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import heic2any from 'heic2any';
import api from "../services/api";
import MessageBubble from './MessageBubble';
import CustomerInfo from './CustomerInfo';
import AISuggestions from './Aisuggestions';
import QuickReplies from './Quickreplies';
import '../styles/ChatWindow.css';
import { parseMarkdown } from '../../utils/parseMarkdown';

// ============ EMOJI DATA ============
const EMOJI_CATEGORIES = [
  {
    label: '😊 Smileys',
    emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖'],
  },
  {
    label: '👋 People',
    emojis: ['👋','🤚','🖐','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦵','🦶','👂','🦻','👃','🫀','🫁','🧠','🦷','🦴','👀','👁','👅','👄'],
  },
  {
    label: '❤️ Hearts',
    emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉','☸️','✡️','🔯','🕎','☯️','☦️','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓'],
  },
  {
    label: '🎉 Celebration',
    emojis: ['🎉','🎊','🎈','🎁','🎀','🎗','🎟','🎫','🏆','🥇','🥈','🥉','🏅','🎖','🏵','🎪','🤹','🎭','🎨','🎬','🎤','🎧','🎼','🎵','🎶','🎹','🥁','🎷','🎺','🎸','🪕','🎻','🎲','♟','🎯','🎳','🎮','🎰','🧩'],
  },
];

function EmojiPicker({ onSelect, onClose }) {
  const [activeCategory, setActiveCategory] = useState(0);
  const [search, setSearch] = useState('');
  const pickerRef = useRef(null);

  const filteredEmojis = search.trim()
    ? EMOJI_CATEGORIES.flatMap(c => c.emojis).filter(e => e.includes(search))
    : EMOJI_CATEGORIES[activeCategory].emojis;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div className="emoji-picker" ref={pickerRef}>
      <div className="emoji-picker-search">
        <input
          type="text"
          placeholder="Search emoji..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="emoji-search-input"
          autoFocus
        />
      </div>
      {!search && (
        <div className="emoji-category-tabs">
          {EMOJI_CATEGORIES.map((cat, i) => (
            <button
              key={i}
              type="button"
              className={`emoji-cat-tab${activeCategory === i ? ' active' : ''}`}
              onClick={() => setActiveCategory(i)}
              title={cat.label}
            >
              {cat.emojis[0]}
            </button>
          ))}
        </div>
      )}
      <div className="emoji-grid">
        {filteredEmojis.length > 0
          ? filteredEmojis.map((emoji, i) => (
              <button
                key={i}
                type="button"
                className="emoji-btn"
                onClick={() => { onSelect(emoji); }}
              >
                {emoji}
              </button>
            ))
          : <div className="emoji-no-results">No results</div>
        }
      </div>
    </div>
  );
}

// ============ SEND EMAIL MODAL ============
function SendEmailModal({ conversation, onClose, onSend }) {
  const customerEmail = conversation?.customerEmail || '';
  const customerName = conversation?.customerName || 'Customer';

  const [to, setTo] = useState(customerEmail);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const bodyRef = useRef(null);

  const handleSend = async () => {
    if (!to.trim()) { setError('Recipient email is required.'); return; }
    if (!subject.trim()) { setError('Subject is required.'); return; }
    if (!body.trim()) { setError('Message body is required.'); return; }
    setError('');
    try {
      setSending(true);
      await onSend({ to: to.trim(), subject: subject.trim(), body: body.trim() });
      setSent(true);
    } catch (err) {
      setError(err.message || 'Failed to send email. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(11,20,26,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '520px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          background: '#00a884',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>✉️</span>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: '15px' }}>Send Email</div>
              <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px' }}>{customerName}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.2)', border: 'none',
              borderRadius: '50%', width: '30px', height: '30px',
              cursor: 'pointer', color: '#fff', fontSize: '15px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>
        </div>

        {sent ? (
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
            <div style={{ fontSize: '17px', fontWeight: 700, color: '#111b21', marginBottom: '6px' }}>Email Sent!</div>
            <div style={{ fontSize: '13px', color: '#667781', marginBottom: '24px' }}>Your message was sent to <strong>{to}</strong></div>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#00a884', color: '#fff', border: 'none',
                borderRadius: '8px', padding: '10px 28px',
                fontSize: '14px', fontWeight: 600, cursor: 'pointer',
              }}
            >Close</button>
          </div>
        ) : (
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#3b4a54', display: 'block', marginBottom: '5px' }}>To</label>
              <input
                type="email"
                value={to}
                onChange={e => setTo(e.target.value)}
                placeholder="customer@example.com"
                style={{
                  width: '100%', padding: '9px 12px',
                  border: '1.5px solid #e9edef', borderRadius: '8px',
                  fontSize: '14px', color: '#111b21', outline: 'none',
                  boxSizing: 'border-box', background: '#f9fafb',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = '#00a884'}
                onBlur={e => e.target.style.borderColor = '#e9edef'}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#3b4a54', display: 'block', marginBottom: '5px' }}>Subject</label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="e.g. Your order tracking update"
                style={{
                  width: '100%', padding: '9px 12px',
                  border: '1.5px solid #e9edef', borderRadius: '8px',
                  fontSize: '14px', color: '#111b21', outline: 'none',
                  boxSizing: 'border-box', background: '#f9fafb',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = '#00a884'}
                onBlur={e => e.target.style.borderColor = '#e9edef'}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#3b4a54', display: 'block', marginBottom: '5px' }}>Message</label>
              <textarea
                ref={bodyRef}
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Write your message here..."
                rows={6}
                style={{
                  width: '100%', padding: '9px 12px',
                  border: '1.5px solid #e9edef', borderRadius: '8px',
                  fontSize: '14px', color: '#111b21', outline: 'none',
                  boxSizing: 'border-box', background: '#f9fafb',
                  resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = '#00a884'}
                onBlur={e => e.target.style.borderColor = '#e9edef'}
              />
              <div style={{ fontSize: '11px', color: '#aab8c2', textAlign: 'right', marginTop: '3px' }}>
                {body.length} chars
              </div>
            </div>
            {error && (
              <div style={{
                background: '#fff5f5', border: '1px solid #fed7d7',
                borderRadius: '8px', padding: '10px 14px',
                fontSize: '13px', color: '#c53030',
              }}>
                ⚠️ {error}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '4px' }}>
              <button
                type="button"
                onClick={onClose}
                disabled={sending}
                style={{
                  background: '#f0f2f5', border: '1px solid #e9edef',
                  borderRadius: '8px', padding: '10px 20px',
                  fontSize: '14px', fontWeight: 500,
                  cursor: sending ? 'not-allowed' : 'pointer', color: '#3b4a54',
                }}
              >Cancel</button>
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || !to.trim() || !subject.trim() || !body.trim()}
                style={{
                  background: sending || !to.trim() || !subject.trim() || !body.trim()
                    ? 'rgba(0,168,132,0.45)' : '#00a884',
                  border: 'none', borderRadius: '8px',
                  padding: '10px 24px', fontSize: '14px',
                  fontWeight: 600, cursor: sending ? 'not-allowed' : 'pointer',
                  color: '#fff', display: 'flex', alignItems: 'center', gap: '8px',
                  boxShadow: '0 2px 6px rgba(0,168,132,0.3)',
                }}
              >
                {sending ? <>⏳ Sending…</> : <>✉️ Send Email</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ BLACKLIST MODAL ============
function BlacklistModal({ conversation, storeName, onClose, onConfirm }) {
  const customerEmail = conversation?.customerEmail || '';
  const customerName = conversation?.customerName || 'Customer';

  // 'store' = current store only | 'all' = all stores
  const [scope, setScope] = useState('store');
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    setError('');
    try {
      setConfirming(true);
      await onConfirm({
        email: customerEmail,
        conversationId: conversation?.id,
        storeIdentifier: conversation?.storeIdentifier,
        allStores: scope === 'all',
        reason: reason.trim(),
        customerName,
      });
      setDone(true);
    } catch (err) {
      setError(err.message || 'Failed to blacklist. Please try again.');
    } finally {
      setConfirming(false);
    }
  };

  const scopeStore = scope === 'store';
  const accentColor = '#e53e3e';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10001,
        background: 'rgba(11,20,26,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '14px',
          width: '100%',
          maxWidth: '480px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.28)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'modalSlideUp 0.22s ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          background: accentColor,
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '22px' }}>🚫</span>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: '15px' }}>Blacklist Customer</div>
              <div style={{ color: 'rgba(255,255,255,0.82)', fontSize: '12px' }}>{customerName}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.2)', border: 'none',
              borderRadius: '50%', width: '30px', height: '30px',
              cursor: 'pointer', color: '#fff', fontSize: '15px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>
        </div>

        {done ? (
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
            <div style={{ fontSize: '17px', fontWeight: 700, color: '#111b21', marginBottom: '6px' }}>
              Customer Blacklisted
            </div>
            <div style={{ fontSize: '13px', color: '#667781', marginBottom: '6px' }}>
              <strong>{customerEmail || customerName}</strong> has been blacklisted
            </div>
            <div style={{ fontSize: '13px', color: '#667781', marginBottom: '24px' }}>
              {scope === 'all'
                ? 'across all stores.'
                : <>from <strong>{storeName || conversation?.storeIdentifier || 'this store'}</strong> only.</>}
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: accentColor, color: '#fff', border: 'none',
                borderRadius: '8px', padding: '10px 28px',
                fontSize: '14px', fontWeight: 600, cursor: 'pointer',
              }}
            >Close</button>
          </div>
        ) : (
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

            <div style={{
              background: '#fff5f5', border: '1px solid #fed7d7',
              borderRadius: '10px', padding: '12px 14px',
              display: 'flex', alignItems: 'center', gap: '10px',
            }}>
              <span style={{ fontSize: '20px' }}>👤</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '14px', color: '#111b21', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {customerName}
                </div>
                <div style={{ fontSize: '12px', color: '#667781', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {customerEmail || 'No email on file'}
                </div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#3b4a54', marginBottom: '10px' }}>
                Blacklist scope
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setScope('store')}
                  style={{
                    flex: 1, padding: '12px 10px',
                    border: `2px solid ${scopeStore ? accentColor : '#e9edef'}`,
                    borderRadius: '10px',
                    background: scopeStore ? '#fff5f5' : '#f9fafb',
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'all 0.15s',
                    outline: 'none',
                  }}
                >
                  <div style={{ fontSize: '20px', marginBottom: '4px' }}>🏪</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: scopeStore ? accentColor : '#111b21' }}>
                    This store only
                  </div>
                  <div style={{ fontSize: '11px', color: '#667781', marginTop: '2px', lineHeight: '1.4' }}>
                    {storeName || conversation?.storeIdentifier || 'Current store'}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setScope('all')}
                  style={{
                    flex: 1, padding: '12px 10px',
                    border: `2px solid ${!scopeStore ? accentColor : '#e9edef'}`,
                    borderRadius: '10px',
                    background: !scopeStore ? '#fff5f5' : '#f9fafb',
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'all 0.15s',
                    outline: 'none',
                  }}
                >
                  <div style={{ fontSize: '20px', marginBottom: '4px' }}>🌐</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: !scopeStore ? accentColor : '#111b21' }}>
                    All stores
                  </div>
                  <div style={{ fontSize: '11px', color: '#667781', marginTop: '2px', lineHeight: '1.4' }}>
                    Block network-wide
                  </div>
                </button>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#3b4a54', display: 'block', marginBottom: '5px' }}>
                Reason <span style={{ fontWeight: 400, color: '#aab8c2' }}>(optional)</span>
              </label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. Repeated chargebacks, abusive behaviour…"
                rows={3}
                style={{
                  width: '100%', padding: '9px 12px',
                  border: '1.5px solid #e9edef', borderRadius: '8px',
                  fontSize: '13px', color: '#111b21', outline: 'none',
                  boxSizing: 'border-box', background: '#f9fafb',
                  resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = accentColor}
                onBlur={e => e.target.style.borderColor = '#e9edef'}
              />
            </div>

            <div style={{
              background: '#fffbeb', border: '1px solid #f6e05e',
              borderRadius: '8px', padding: '10px 14px',
              fontSize: '12px', color: '#744210',
              display: 'flex', gap: '8px', alignItems: 'flex-start',
            }}>
              <span style={{ flexShrink: 0, marginTop: '1px' }}>⚠️</span>
              <span>
                {scope === 'all'
                  ? 'This will block the customer from contacting support across every store in your network.'
                  : `This will block the customer from contacting support on ${storeName || 'this store'} only.`}
                {' '}This action can be undone from the Blacklist Manager.
              </span>
            </div>

            {error && (
              <div style={{
                background: '#fff5f5', border: '1px solid #fed7d7',
                borderRadius: '8px', padding: '10px 14px',
                fontSize: '13px', color: '#c53030',
              }}>
                ⚠️ {error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '2px' }}>
              <button
                type="button"
                onClick={onClose}
                disabled={confirming}
                style={{
                  background: '#f0f2f5', border: '1px solid #e9edef',
                  borderRadius: '8px', padding: '10px 20px',
                  fontSize: '14px', fontWeight: 500,
                  cursor: confirming ? 'not-allowed' : 'pointer', color: '#3b4a54',
                }}
              >Cancel</button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={confirming}
                style={{
                  background: confirming ? 'rgba(229,62,62,0.45)' : accentColor,
                  border: 'none', borderRadius: '8px',
                  padding: '10px 24px', fontSize: '14px',
                  fontWeight: 600, cursor: confirming ? 'not-allowed' : 'pointer',
                  color: '#fff', display: 'flex', alignItems: 'center', gap: '8px',
                  boxShadow: '0 2px 6px rgba(229,62,62,0.3)',
                }}
              >
                {confirming ? <>⏳ Blacklisting…</> : <>🚫 Blacklist Customer</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ ARCHIVE MODAL ============
function ArchiveModal({ conversation, storeName, onClose, onConfirm }) {
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    setError('');
    try {
      setArchiving(true);
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to archive. Please try again.');
      setArchiving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10001,
        background: 'rgba(11,20,26,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff', borderRadius: '14px',
          width: '100%', maxWidth: '420px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
          overflow: 'hidden',
          animation: 'modalSlideUp 0.22s ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          background: '#6366f1', padding: '16px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '22px' }}>📦</span>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: '15px' }}>Archive Conversation</div>
              <div style={{ color: 'rgba(255,255,255,0.82)', fontSize: '12px' }}>
                {conversation?.customerName || 'Customer'} · {storeName || conversation?.storeIdentifier}
              </div>
            </div>
          </div>
          <button
            type="button" onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.2)', border: 'none',
              borderRadius: '50%', width: '30px', height: '30px',
              cursor: 'pointer', color: '#fff', fontSize: '15px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>
        </div>

        <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ margin: 0, fontSize: '14px', color: '#3b4a54', lineHeight: '1.6' }}>
            This conversation will be moved to the <strong>Archive</strong>. It won't appear in the
            active inbox but remains fully searchable and can be restored at any time.
          </p>

          <div style={{
            background: '#f0f0ff', border: '1px solid #c7d2fe',
            borderRadius: '8px', padding: '10px 14px',
            fontSize: '12px', color: '#3730a3',
            display: 'flex', gap: '8px', alignItems: 'flex-start',
          }}>
            <span style={{ flexShrink: 0 }}>ℹ️</span>
            <span>Unlike Delete, archived conversations are never permanently removed.</span>
          </div>

          {error && (
            <div style={{
              background: '#fff5f5', border: '1px solid #fed7d7',
              borderRadius: '8px', padding: '10px 14px',
              fontSize: '13px', color: '#c53030',
            }}>
              ⚠️ {error}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
            <button
              type="button" onClick={onClose} disabled={archiving}
              style={{
                background: '#f0f2f5', border: '1px solid #e9edef',
                borderRadius: '8px', padding: '10px 20px',
                fontSize: '14px', fontWeight: 500,
                cursor: archiving ? 'not-allowed' : 'pointer', color: '#3b4a54',
              }}
            >Cancel</button>
            <button
              type="button" onClick={handleConfirm} disabled={archiving}
              style={{
                background: archiving ? 'rgba(99,102,241,0.45)' : '#6366f1',
                border: 'none', borderRadius: '8px',
                padding: '10px 24px', fontSize: '14px',
                fontWeight: 600, cursor: archiving ? 'not-allowed' : 'pointer',
                color: '#fff', display: 'flex', alignItems: 'center', gap: '8px',
                boxShadow: '0 2px 6px rgba(99,102,241,0.3)',
              }}
            >
              {archiving ? <>⏳ Archiving…</> : <>📦 Archive</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ HELPER: parse fileData safely ============
const parseFileData = (raw) => {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return null; }
};

// ============ HELPER: normalize messages from server ============
const normalizeMessage = (msg) => ({
  ...msg,
  fileData: parseFileData(msg.fileData || msg.file_data),
});

// ============ SHARED INPUT STYLE ============
const INPUT_STYLE = {
  fontSize:     '14px',
  lineHeight:   '1.5',
  fontFamily:   'inherit',
  padding:      '9px 12px',
  whiteSpace:   'pre-wrap',
  wordBreak:    'break-word',
  overflowWrap: 'break-word',
};


function ActionsDropdown({
  conversation, onSendEmail, onMarkAsUnread,
  onArchive, onBlacklist, onCustomerInfo, onDelete,
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const item = (icon, label, onClick, danger = false) => (
    <button
      type="button"
      onClick={() => { onClick(); setOpen(false); }}
      style={{
        width: '100%', textAlign: 'left', padding: '9px 14px',
        border: 'none', background: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: '10px',
        fontSize: '13.5px', fontWeight: 500,
        color: danger ? '#e53e3e' : '#111b21',
        transition: 'background 0.1s',
        fontFamily: 'inherit',
      }}
      onMouseEnter={e => e.currentTarget.style.background = danger ? '#fff5f5' : '#f0f2f5'}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}
    >
      <span style={{ fontSize: '16px', width: '20px', textAlign: 'center', flexShrink: 0 }}>{icon}</span>
      {label}
    </button>
  );

  const divider = () => (
    <div style={{ height: '1px', background: '#e9edef', margin: '3px 0' }} />
  );

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '6px 12px', border: '1px solid #e9edef',
          borderRadius: '8px', cursor: 'pointer',
          background: open ? '#f0f2f5' : '#fff',
          color: '#3b4a54',
          fontSize: '13px', fontWeight: 600,
          transition: 'background 0.15s, border-color 0.15s',
          fontFamily: 'inherit',
          boxShadow: open ? 'none' : '0 1px 2px rgba(11,20,26,0.06)',
        }}
        onMouseEnter={e => {
          if (!open) {
            e.currentTarget.style.background = '#f0f2f5';
            e.currentTarget.style.borderColor = '#d1d7db';
          }
        }}
        onMouseLeave={e => {
          if (!open) {
            e.currentTarget.style.background = '#fff';
            e.currentTarget.style.borderColor = '#e9edef';
          }
        }}
        title="Actions"
      >
        Actions
        <span style={{
          fontSize: '10px', color: '#8696a0',
          transform: open ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.2s', display: 'inline-block',
        }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0,
          minWidth: '210px', background: '#fff',
          border: '1px solid rgba(0,0,0,0.08)', borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(11,20,26,0.07), 0 12px 28px rgba(11,20,26,0.13)',
          zIndex: 1000, overflow: 'hidden', padding: '5px 0',
          animation: 'actionsDropIn 0.14s cubic-bezier(0.34,1.56,0.64,1)',
        }}>
          {item('✉️', conversation?.customerEmail ? `Email ${conversation.customerEmail.split('@')[0]}` : 'Send Email', onSendEmail)}
          {onMarkAsUnread && item('🔵', 'Mark as Unread', onMarkAsUnread)}
          {divider()}
          {item('📦', 'Archive', onArchive)}
          {divider()}
          {item('🚫', 'Blacklist Customer', onBlacklist, true)}
          {item('🗑️', 'Delete Conversation', onDelete, true)}
        </div>
      )}

      <style>{`
        @keyframes actionsDropIn {
          from { opacity: 0; transform: scale(0.93) translateY(-4px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ============ MAIN COMPONENT ============
function ChatWindow({
  conversation,
  onSendMessage,
  onClose,
  onTyping,
  employeeName,
  onMenuToggle,
  stores,
  isAdmin = false,
  onMarkAsUnread,
  onArchive,
  onBlacklist,
}) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [showCustomerInfo, setShowCustomerInfo] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showAISuggestions, setShowAISuggestions] = useState(true);

  // Mark as unread toast
  const [unreadToast, setUnreadToast] = useState(false);
  const unreadToastTimerRef = useRef(null);

  // Message delete state
  const [messageToDelete, setMessageToDelete] = useState(null);
  const [deletingMessage, setDeletingMessage] = useState(false);

  // File upload states
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Emoji picker state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Template / Quick Reply states
  const [templates, setTemplates] = useState([]);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);

  // Send email state
  const [showEmailModal, setShowEmailModal] = useState(false);

  // Blacklist + Archive state
  const [showBlacklistModal, setShowBlacklistModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal]     = useState(false);

  // Legal threat state
  const [legalAlert, setLegalAlert] = useState(null);
  const legalDismissTimerRef = useRef(null);

  // ─────────────────────────────────────────────────────────────
  // AUTO-REPLY NOTE:
  // The frontend setTimeout-based auto-reply has been removed.
  // Auto-replies are now sent exclusively by the backend cron in
  // server.js (see "AUTO-REPLY 3-minute no-response rule" block),
  // rate-limited in database.js to once per 8 hours per conversation.
  // This prevents duplicate sends and keeps per-agent response-time
  // stats accurate (no fake instant "replies" attributed to the
  // viewing agent).
  // ─────────────────────────────────────────────────────────────

  const messagesEndRef = useRef(null);
  const editableRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const wsRef = useRef(null);
  const displayedMessageIds = useRef(new Set());
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const hasAuthenticated = useRef(false);
  const hasJoined = useRef(false);
  const activeNotificationsRef = useRef(new Map());
  const pollIntervalRef = useRef(null);

  const conversationRef = useRef(conversation);
  const employeeNameRef = useRef(employeeName);
  const handleWsMessageRef = useRef(null);

  useEffect(() => { loadTemplates(); }, []);
  useEffect(() => { conversationRef.current = conversation; }, [conversation]);
  useEffect(() => { employeeNameRef.current = employeeName; }, [employeeName]);

  useEffect(() => {
    return () => {
      if (legalDismissTimerRef.current) clearTimeout(legalDismissTimerRef.current);
      if (unreadToastTimerRef.current) clearTimeout(unreadToastTimerRef.current);
    };
  }, []);

  // ============ WYSIWYG HELPERS ============
  const htmlToMarkdown = (html) => {
    if (!html) return '';
    return html
      .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<b>(.*?)<\/b>/gi, '**$1**')
      .replace(/<em>(.*?)<\/em>/gi, '*$1*')
      .replace(/<i>(.*?)<\/i>/gi, '*$1*')
      .replace(/<s>(.*?)<\/s>/gi, '~~$1~~')
      .replace(/<strike>(.*?)<\/strike>/gi, '~~$1~~')
      .replace(/<code>(.*?)<\/code>/gi, '`$1`')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/<[^>]+>/g, '')
      .trim();
  };

  const getMessageContent = () => htmlToMarkdown(editableRef.current?.innerHTML || '');

  const clearInput = () => {
    if (editableRef.current) editableRef.current.innerHTML = '';
    setMessageText('');
  };

  const setInputContent = (text) => {
    if (editableRef.current) {
      editableRef.current.innerHTML = parseMarkdown(text);
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(editableRef.current);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      editableRef.current.focus();
    }
    setMessageText(text);
  };

  // ============ TEMPLATE / SUGGESTION HANDLERS ============
  const loadTemplates = async () => {
    try {
      const data = await api.getTemplates();
      setTemplates(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load templates:', error);
      setTemplates([]);
    }
  };

  const handleSendEmail = async ({ to, subject, body }) => {
    await api.sendEmail({
      to,
      subject,
      body,
      conversationId: conversation?.id,
      customerName: conversation?.customerName,
    });
  };

  const handleMarkAsUnread = () => {
    if (!onMarkAsUnread || !conversation?.id) return;
    onMarkAsUnread(conversation.id);
    setUnreadToast(true);
    if (unreadToastTimerRef.current) clearTimeout(unreadToastTimerRef.current);
    unreadToastTimerRef.current = setTimeout(() => setUnreadToast(false), 2500);
  };

  const handleUseTemplate = (content) => { setInputContent(content); };

  const handleAddQuickReply = async ({ name, content }) => {
    const newTemplate = await api.createTemplate({ name, content });
    setTemplates(prev => [...prev, newTemplate]);
  };

  const handleSaveQuickReply = async (templateId, { name, content }) => {
    const updated = await api.updateTemplate(templateId, { name, content });
    setTemplates(prev => prev.map(t => t.id === templateId ? updated : t));
  };

  const handleDeleteQuickReply = async (templateId) => {
    await api.deleteTemplate(templateId);
    setTemplates(prev => prev.filter(t => t.id !== templateId));
  };

  const handleSelectSuggestion = (suggestion) => { setInputContent(suggestion); };

  // ============ EMOJI HANDLER ============
  const handleEmojiSelect = (emoji) => {
    if (editableRef.current) {
      editableRef.current.focus();
      document.execCommand('insertText', false, emoji);
      setMessageText(editableRef.current.innerText);
    }
  };

  // ============ MESSAGE DELETE HANDLERS ============
  const handleDeleteMessageClick = (message) => { setMessageToDelete(message); };
  const handleCancelMessageDelete = () => { setMessageToDelete(null); };

  const handleConfirmMessageDelete = async () => {
    if (!messageToDelete) return;
    try {
      setDeletingMessage(true);
      await api.deleteMessage(messageToDelete.id);
      displayedMessageIds.current.delete(String(messageToDelete.id));
      setMessages(prev => prev.filter(m => String(m.id) !== String(messageToDelete.id)));
      setMessageToDelete(null);
    } catch (error) {
      console.error('Failed to delete message:', error);
      alert(`Failed to delete message: ${error.message}`);
    } finally {
      setDeletingMessage(false);
    }
  };

  // ============ ARCHIVE HANDLER ============
  const handleConfirmArchive = async () => {
    if (onArchive) {
      await onArchive(conversation.id);
    } else {
      await api.archiveConversation(conversation.id);
    }
    setShowArchiveModal(false);
    if (onClose) onClose();
  };

  // ============ BLACKLIST HANDLER ============
  const handleConfirmBlacklist = async (payload) => {
    if (onBlacklist) {
      await onBlacklist(payload);
    } else {
      await api.blacklistCustomer(payload);
    }
  };

  // ============ FILE HANDLING ============
  const handleAttachClick = () => { if (fileInputRef.current) fileInputRef.current.click(); };

  const handleFileSelect = async (e) => {
    let file = e.target.files[0];
    if (!file) return;
    const maxSize = 10 * 1024 * 1024;
    const isHeic = file.type === 'image/heic' || file.type === 'image/heif'
      || /\.(heic|heif)$/i.test(file.name);
    if (isHeic) {
      try {
        const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 });
        file = new File([blob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
      } catch (err) {
        console.error('HEIC conversion failed:', err);
        alert('Could not convert HEIC image. Please export it as JPEG first.');
        return;
      }
    }
    if (file.size > maxSize) { alert('File size must be less than 10MB'); return; }
    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setFilePreview({ type: 'image', url: e.target.result, name: file.name });
      reader.readAsDataURL(file);
    } else {
      setFilePreview({ type: 'file', name: file.name, size: formatFileSize(file.size) });
    }
  };

  const handlePaste = async (e) => {
    const items = Array.from(e.clipboardData?.items || []);
    if (!items.length) return;

    const plainText = e.clipboardData.getData('text/plain') || '';
    if (/file:\/\/[^\s]*\.hei[cf]/i.test(plainText.trim())) {
      e.preventDefault();
      alert('HEIC images cannot be pasted directly. Please share the photo as JPEG instead.');
      return;
    }

    for (const item of items) {
      if (!item.type.startsWith('image/')) continue;
      e.preventDefault();
      let file = item.getAsFile();
      if (!file) continue;
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) { alert('Pasted image must be less than 10MB'); return; }
      const isHeic = file.type === 'image/heic' || file.type === 'image/heif'
        || /\.hei[cf]$/i.test(file.name);
      if (isHeic) {
        try {
          const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 });
          file = new File([blob], `screenshot-${Date.now()}.jpg`, { type: 'image/jpeg' });
        } catch (err) {
          console.error('HEIC conversion failed:', err);
          alert('Could not convert HEIC image. Please share the photo as JPEG instead.');
          return;
        }
      }
      const ext = file.type.split('/')[1] || 'png';
      const namedFile = new File([file], `screenshot-${Date.now()}.${ext}`, { type: file.type });
      setSelectedFile(namedFile);
      const reader = new FileReader();
      reader.onload = (ev) => setFilePreview({ type: 'image', url: ev.target.result, name: namedFile.name });
      reader.readAsDataURL(namedFile);
      break;
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const uploadFileToBunny = async (file) => {
    try {
      setUploading(true);
      setUploadProgress(0);
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.uploadFile(formData, (progressEvent) => {
        setUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
      });
      return response;
    } catch (error) {
      console.error('❌ File upload failed:', error);
      throw error;
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // ============ WEBSOCKET ============
  const getWsUrl = () => {
    let baseUrl = api.baseUrl || import.meta.env.VITE_API_URL || '';
    if (!baseUrl) baseUrl = window.location.origin;
    baseUrl = baseUrl.replace(/\/$/, '');
    return baseUrl.replace(/^http/, 'ws') + '/ws';
  };

  const connectWebSocket = () => {
    disconnectWebSocket();
    if (!conversationRef.current?.id) return;
    const token = localStorage.getItem('token');
    if (!token) { console.error('❌ [WS] No auth token found'); return; }
    try {
      const wsUrl = getWsUrl();
      hasAuthenticated.current = false;
      hasJoined.current = false;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => {
        reconnectAttempts.current = 0;
        ws.send(JSON.stringify({ type: 'auth', token, clientType: 'agent' }));
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (handleWsMessageRef.current) handleWsMessageRef.current(data);
        } catch (error) { console.error('❌ [WS] Parse error:', error); }
      };
      ws.onerror = () => setWsConnected(false);
      ws.onclose = (event) => {
        setWsConnected(false);
        hasAuthenticated.current = false;
        hasJoined.current = false;
        wsRef.current = null;
        if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts && conversationRef.current?.id) {
          reconnectAttempts.current++;
          const delay = Math.min(2000 * reconnectAttempts.current, 10000);
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, delay);
        }
      };
    } catch (error) {
      console.error('❌ [WS] Connection failed:', error);
      setWsConnected(false);
    }
  };

  const disconnectWebSocket = () => {
    if (reconnectTimeoutRef.current) { clearTimeout(reconnectTimeoutRef.current); reconnectTimeoutRef.current = null; }
    if (wsRef.current) {
      const ws = wsRef.current;
      wsRef.current = null;
      hasAuthenticated.current = false;
      hasJoined.current = false;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close(1000, 'Component unmounting');
    }
    setWsConnected(false);
  };

  // ============ LEGAL ALERT HELPERS ============
  const showLegalAlert = (alert) => {
    if (legalDismissTimerRef.current) clearTimeout(legalDismissTimerRef.current);
    setLegalAlert(alert);
    legalDismissTimerRef.current = setTimeout(() => setLegalAlert(null), 15000);
  };

  const dismissLegalAlert = () => {
    if (legalDismissTimerRef.current) clearTimeout(legalDismissTimerRef.current);
    setLegalAlert(null);
  };

  const handleWebSocketMessage = (data) => {
    const currentConv = conversationRef.current;
    const currentEmployeeName = employeeNameRef.current;

    switch (data.type) {
      case 'connected': break;

      case 'auth_ok':
        hasAuthenticated.current = true;
        if (currentConv?.id && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'join_conversation',
            conversationId: parseInt(currentConv.id),
            role: 'agent',
            employeeName: currentEmployeeName || 'Agent'
          }));
        }
        break;

      case 'joined':
        hasJoined.current = true;
        setWsConnected(true);
        break;

      case 'new_message':
        if (data.message) handleIncomingMessage(data.message, currentConv, currentEmployeeName);
        break;

      case 'message_confirmed':
        if (data.tempId && data.message) {
          const confirmedMsg = normalizeMessage(data.message);
          setMessages(prev => prev.map(msg =>
            String(msg.id) === String(data.tempId)
              ? { ...confirmedMsg, fileData: confirmedMsg.fileData || msg.fileData, fileUrl: confirmedMsg.fileUrl || msg.fileUrl, sending: false, _optimistic: false }
              : msg
          ));
          if (data.message.id) displayedMessageIds.current.add(String(data.message.id));
        }
        break;

      case 'message_failed':
        if (data.tempId) {
          setMessages(prev => prev.map(msg =>
            String(msg.id) === String(data.tempId)
              ? { ...msg, sending: false, failed: true, _optimistic: false }
              : msg
          ));
        }
        break;

      case 'message_deleted':
        if (data.messageId) {
          displayedMessageIds.current.delete(String(data.messageId));
          setMessages(prev => prev.filter(m => String(m.id) !== String(data.messageId)));
        }
        break;

      case 'legal_threat_detected': {
        const alert = data.alert;
        if (!alert) break;
        console.warn(`🚨 [LEGAL] ${alert.severity?.toUpperCase()} — "${alert.matchedTerm}" in conv #${alert.conversationId}`);
        playNotificationSound();
        setTimeout(() => playNotificationSound(), 400);
        if (String(alert.conversationId) === String(currentConv?.id)) {
          showLegalAlert(alert);
        } else {
          if (Notification.permission === 'granted') {
            const emoji = alert.severity === 'critical' ? '🚨' : alert.severity === 'high' ? '⚠️' : '🔔';
            try {
              const n = new Notification(`${emoji} Legal Threat — Conv #${alert.conversationId}`, {
                body: `${alert.severity?.toUpperCase()}: "${alert.matchedTerm}" from ${alert.senderName}`,
                icon: '/favicon.ico',
                requireInteraction: alert.severity === 'critical',
                tag: `legal-${alert.conversationId}`,
              });
              n.onclick = () => { window.focus(); n.close(); };
              if (alert.severity !== 'critical') setTimeout(() => n.close(), 8000);
            } catch (e) {}
          }
        }
        break;
      }

      case 'typing': handleTypingIndicator(data); break;
      case 'customer_left': setTypingUsers(new Set()); break;

      case 'error':
        console.error('❌ [WS] Server error:', data.message);
        if (data.message?.includes('token') || data.message?.includes('auth')) {
          hasAuthenticated.current = false;
          hasJoined.current = false;
          setWsConnected(false);
        }
        break;

      default: break;
    }
  };

  handleWsMessageRef.current = handleWebSocketMessage;

  const handleIncomingMessage = (message, currentConv, currentEmployeeName) => {
    const msgId = message.id;
    const convId = message.conversationId || message.conversation_id;
    if (convId && String(convId) !== String(currentConv?.id)) { showNotification(message); return; }
    if (msgId && displayedMessageIds.current.has(String(msgId))) return;
    if (message.senderType === 'agent' && currentEmployeeName && message.senderName === currentEmployeeName) {
      if (msgId) displayedMessageIds.current.add(String(msgId));
      return;
    }
    if (msgId) displayedMessageIds.current.add(String(msgId));
    const normalized = normalizeMessage(message);
    setMessages(prev => {
      if (prev.some(m => String(m.id) === String(msgId))) return prev;
      return [...prev, { ...normalized, sending: false, _optimistic: false }];
    });

    // Notify on customer messages. Auto-reply is now handled exclusively
    // by the backend cron (once per 8 hours per conversation) — we do NOT
    // fire any timer here. See comment at top of MAIN COMPONENT.
    if (message.senderType === 'customer') {
      showNotification(message);
    }
  };

  const showNotification = (message) => {
    if (!message || message.senderType === 'agent') return;
    playNotificationSound();
    if (Notification.permission === 'granted') createNotification(message);
    else if (Notification.permission !== 'denied') Notification.requestPermission().then(p => { if (p === 'granted') createNotification(message); });
  };

  const createNotification = (message) => {
    try {
      const senderName = message.senderName || message.customerName || 'Customer';
      const content = message.content || (message.fileData ? '📎 Sent a file' : 'New message');
      const notification = new Notification(`New message from ${senderName}`, {
        body: content.substring(0, 100),
        icon: '/favicon.ico',
        tag: `msg-${message.id || Date.now()}`,
        requireInteraction: false
      });
      notification.onclick = () => { window.focus(); notification.close(); };
      setTimeout(() => notification.close(), 5000);
    } catch (error) { console.warn('Notification failed:', error); }
  };

  const clearAllNotifications = (conversationId) => {
    const notifications = activeNotificationsRef.current.get(conversationId);
    if (notifications) {
      notifications.forEach(n => { try { n.close(); } catch (e) {} });
      activeNotificationsRef.current.delete(conversationId);
    }
  };

  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.1;
      oscillator.start();
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {}
  };

  const handleTypingIndicator = (data) => {
    if (data.senderType === 'agent') return;
    const senderName = data.senderName || 'Customer';
    if (data.isTyping) {
      setTypingUsers(prev => new Set([...prev, senderName]));
      setTimeout(() => setTypingUsers(prev => {
        const next = new Set(prev); next.delete(senderName); return next;
      }), 5000);
    } else {
      setTypingUsers(prev => { const next = new Set(prev); next.delete(senderName); return next; });
    }
  };

  const sendTypingIndicator = (isTyping) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && conversationRef.current?.id && hasJoined.current) {
      wsRef.current.send(JSON.stringify({
        type: 'typing',
        conversationId: parseInt(conversationRef.current.id),
        isTyping,
        senderType: 'agent',
        senderName: employeeNameRef.current || 'Agent'
      }));
    }
  };

  // ============ EFFECTS ============
  useEffect(() => {
    if (!conversation) { disconnectWebSocket(); return; }
    connectWebSocket();
    return () => disconnectWebSocket();
  }, [conversation?.id, employeeName]);

  useEffect(() => {
    return () => { if (conversation?.id) clearAllNotifications(conversation.id); };
  }, [conversation?.id]);

  useEffect(() => {
    if (conversation) { displayedMessageIds.current.clear(); loadMessages(); }
    else { setMessages([]); setLoading(false); }
    dismissLegalAlert();
    setShowEmailModal(false);
    setShowBlacklistModal(false);
    setShowArchiveModal(false);
    setUnreadToast(false);
    clearInput();
  }, [conversation?.id]);

  useEffect(() => { scrollToBottom(); }, [messages]);

  useEffect(() => {
    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
    return () => clearInterval(pingInterval);
  }, []);

  useEffect(() => {
    if (!conversation?.id) { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); return; }
    pollIntervalRef.current = setInterval(async () => {
      try {
        const data = await api.getMessages(conversation.id);
        const serverMessages = (Array.isArray(data) ? data : []).map(normalizeMessage);
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => String(m.id)));
          const newMessages = serverMessages.filter(m => m.id && !existingIds.has(String(m.id)) && !displayedMessageIds.current.has(String(m.id)));
          if (newMessages.length === 0) return prev;
          newMessages.forEach(m => { if (m.id) displayedMessageIds.current.add(String(m.id)); });
          let updated = prev.map(existing => {
            if (!String(existing.id).startsWith('temp-')) return existing;
            const confirmed = serverMessages.find(s =>
              s.content === existing.content &&
              s.senderType === existing.senderType &&
              !existingIds.has(String(s.id))
            );
            if (confirmed) {
              displayedMessageIds.current.add(String(confirmed.id));
              return { ...confirmed, sending: false, _optimistic: false };
            }
            return existing;
          });
          return [...updated, ...newMessages.map(m => ({ ...m, sending: false, _optimistic: false }))];
        });
      } catch (error) {}
    }, 5000);
    return () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); };
  }, [conversation?.id]);

  useEffect(() => {
    const handleGlobalPaste = (e) => {
      const tag = document.activeElement?.tagName;
      const isEditable = document.activeElement?.contentEditable === 'true';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || isEditable) return;
      handlePaste(e);
    };
    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [selectedFile]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const data = await api.getMessages(conversation.id);
      const messageArray = (Array.isArray(data) ? data : []).map(normalizeMessage);
      messageArray.forEach(msg => { if (msg.id) displayedMessageIds.current.add(String(msg.id)); });
      setMessages(messageArray);
    } catch (error) {
      console.error('Failed to load messages:', error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); };

  // ============ SEND ============
  const handleSend = async (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    const text = getMessageContent();
    const hasText = text.length > 0;
    const hasFile = selectedFile;
    if ((!hasText && !hasFile) || sending || uploading) return;

    try {
      setSending(true);

      let fileUrl = null;
      let fileData = null;
      if (selectedFile) {
        const uploadResult = await uploadFileToBunny(selectedFile);
        fileUrl = uploadResult.url;
        fileData = { url: uploadResult.url, name: selectedFile.name, type: selectedFile.type, size: selectedFile.size };
      }

      clearInput();
      handleRemoveFile();
      setShowEmojiPicker(false);
      sendTypingIndicator(false);

      const optimisticMessage = {
        id: `temp-${Date.now()}`,
        conversationId: conversation.id,
        senderType: 'agent',
        senderName: employeeName || 'Agent',
        content: text || '',
        fileUrl,
        fileData,
        createdAt: new Date().toISOString(),
        _optimistic: true,
        sending: true,
      };
      setMessages(prev => [...prev, optimisticMessage]);
      clearAllNotifications(conversation.id);

      const sentMessage = await onSendMessage(conversation, text, fileData);
      if (sentMessage.id) displayedMessageIds.current.add(String(sentMessage.id));
      const normalizedSent = normalizeMessage(sentMessage);
      const mergedMessage = {
        ...normalizedSent,
        fileUrl: normalizedSent.fileUrl || fileUrl,
        fileData: normalizedSent.fileData || fileData,
        sending: false,
      };
      setMessages(prev => prev.map(msg => msg._optimistic && msg.id === optimisticMessage.id ? mergedMessage : msg));
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      setMessages(prev => prev.filter(msg => !msg._optimistic));
      setInputContent(text);
      alert(`Failed to send message: ${error.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleDeleteClick = () => setShowDeleteModal(true);
  const handleCancelDelete = () => setShowDeleteModal(false);

  const handleConfirmDelete = async () => {
    try {
      setDeleting(true);
      await api.closeConversation(conversation.id);
      setShowDeleteModal(false);
      if (onClose) onClose();
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      alert('Failed to delete conversation. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const handleBackClick = () => { if (onClose) onClose(); };

  const getInitials = (name) => {
    if (!name) return 'G';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getGroupedMessages = () => {
    if (!messages || messages.length === 0) return [];
    return messages.map((message, index) => {
      const prevMessage = index > 0 ? messages[index - 1] : null;
      const nextMessage = index < messages.length - 1 ? messages[index + 1] : null;
      return {
        ...message,
        isFirstInGroup: !prevMessage || prevMessage.senderType !== message.senderType,
        isLastInGroup: !nextMessage || nextMessage.senderType !== message.senderType,
      };
    });
  };

  const getStoreDetails = () => {
    if (!stores || !conversation) return null;
    return stores.find(s =>
      s.storeIdentifier === conversation.storeIdentifier ||
      s.id === conversation.shopId ||
      s.id === conversation.shop_id ||
      s.storeIdentifier === conversation.store_identifier
    ) || null;
  };

  if (!conversation) {
    return (
      <div className="chat-window">
        <div className="empty-state">
          <div className="empty-state-icon">💬</div>
          <h3>No conversation selected</h3>
          <p>Select a conversation from the list to start chatting</p>
        </div>
      </div>
    );
  }

  const storeDetails = getStoreDetails();
  const storeName = storeDetails?.brandName || conversation.storeName || conversation.storeIdentifier;
  const storeDomain = storeDetails?.domain || storeDetails?.url || storeDetails?.storeDomain || storeDetails?.shopDomain || storeDetails?.myshopify_domain || conversation.domain || conversation.storeDomain || null;
  const groupedMessages = getGroupedMessages();

  const legalBannerBg = legalAlert?.severity === 'critical' ? '#dc2626'
    : legalAlert?.severity === 'high' ? '#d97706'
    : '#2563eb';
  const legalBannerEmoji = legalAlert?.severity === 'critical' ? '🚨'
    : legalAlert?.severity === 'high' ? '⚠️'
    : '🔔';

  return (
    <div className="chat-window" style={{ position: 'relative' }}>

      {showEmailModal && (
        <SendEmailModal
          conversation={conversation}
          onClose={() => setShowEmailModal(false)}
          onSend={handleSendEmail}
        />
      )}

      {showBlacklistModal && (
        <BlacklistModal
          conversation={conversation}
          storeName={storeName}
          onClose={() => setShowBlacklistModal(false)}
          onConfirm={handleConfirmBlacklist}
        />
      )}

      {showArchiveModal && (
        <ArchiveModal
          conversation={conversation}
          storeName={storeName}
          onClose={() => setShowArchiveModal(false)}
          onConfirm={handleConfirmArchive}
        />
      )}

      {legalAlert && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 9999,
          background: legalBannerBg, color: 'white', padding: '10px 16px',
          display: 'flex', alignItems: 'center', gap: '10px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.3)', animation: 'legalSlideDown 0.3s ease',
        }}>
          <span style={{ fontSize: '22px', flexShrink: 0 }}>{legalBannerEmoji}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '2px' }}>
              Legal Threat Detected — {legalAlert.severity?.toUpperCase()}
              {legalAlert.fromAttachment && (
                <span style={{ marginLeft: '8px', background: 'rgba(255,255,255,0.2)', padding: '1px 6px', borderRadius: '4px', fontSize: '10px' }}>
                  📎 FROM FILE
                </span>
              )}
            </div>
            <div style={{ fontSize: '12px', opacity: 0.92, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {legalAlert.documentType ? `Document: ${legalAlert.documentType}` : `Matched: "${legalAlert.matchedTerm}"`}
              {legalAlert.snippet && (
                <span style={{ marginLeft: '8px', fontStyle: 'italic', opacity: 0.8 }}>
                  · "{legalAlert.snippet.substring(0, 70)}{legalAlert.snippet.length > 70 ? '…' : ''}"
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.2)', padding: '3px 8px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
              Priority → URGENT
            </span>
            <button
              type="button" onClick={dismissLegalAlert} title="Dismiss"
              style={{
                background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%',
                width: '26px', height: '26px', cursor: 'pointer', color: 'white',
                fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.35)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
            >✕</button>
          </div>
        </div>
      )}

      {unreadToast && (
        <div style={{
          position: 'absolute', top: legalAlert ? '66px' : '10px', left: '50%',
          transform: 'translateX(-50%)', zIndex: 9998, background: '#111b21',
          color: '#fff', fontSize: '13px', fontWeight: 500, padding: '8px 16px',
          borderRadius: '20px', whiteSpace: 'nowrap', boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
          animation: 'unreadToastIn 0.2s ease', pointerEvents: 'none',
        }}>
          🔵 Marked as unread
        </div>
      )}

      <div className="chat-header" style={legalAlert ? { marginTop: '56px' } : {}}>
        <div className="chat-header-left">
          <button className="chat-back-btn-mobile" onClick={handleBackClick} aria-label="Back to conversations" type="button">←</button>
          <div className="chat-header-avatar">{getInitials(conversation.customerName)}</div>
          <div className="chat-header-info">
            <h3>
              {conversation.customerName || 'Guest'}
              {conversation.legalFlag && (
                <span title={`Legal flag: ${conversation.legalFlagSeverity}`} style={{ marginLeft: '6px', fontSize: '14px' }}>
                  {conversation.legalFlagSeverity === 'critical' ? '🚨' : '⚠️'}
                </span>
              )}
            </h3>
            <div className="chat-header-subtitle">
              {storeName && (
                <span className="store-info">
                  <strong>{storeName}</strong>
                  {storeDomain && ` • ${storeDomain}`}
                </span>
              )}
              <span className="customer-email-desktop">{storeName && ' • '}{conversation.customerEmail || 'No email'}</span>
              <span
                style={{ color: wsConnected ? '#48bb78' : '#fc8181', marginLeft: '8px' }}
                title={wsConnected ? 'Connected' : 'Disconnected'}
              >●</span>
            </div>
          </div>
        </div>

        <div className="chat-actions">
          <button
            className="icon-btn"
            onClick={() => setShowAISuggestions(!showAISuggestions)}
            title={showAISuggestions ? 'Hide AI suggestions' : 'Show AI suggestions'}
            type="button"
            style={{ color: showAISuggestions ? '#00a884' : undefined, fontStyle: 'normal' }}
          >✦</button>

          <ActionsDropdown
            conversation={conversation}
            onSendEmail={() => setShowEmailModal(true)}
            onMarkAsUnread={onMarkAsUnread ? handleMarkAsUnread : null}
            onArchive={() => setShowArchiveModal(true)}
            onBlacklist={() => setShowBlacklistModal(true)}
            onCustomerInfo={() => setShowCustomerInfo(v => !v)}
            onDelete={handleDeleteClick}
          />
        </div>
      </div>

      {showDeleteModal && (
        <div className="modal-overlay" onClick={handleCancelDelete}>
          <div className="modal-content delete-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>🗑️ Delete Conversation</h3></div>
            <div className="modal-body">
              <p>Are you sure you want to delete this conversation?</p>
              <div className="delete-warning">
                <p><strong>Customer:</strong> {conversation.customerName || 'Guest'}</p>
                <p><strong>Store:</strong> {storeName}</p>
                <p className="warning-text">⚠️ This action cannot be undone. All messages will be permanently deleted.</p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={handleCancelDelete} disabled={deleting} type="button">Cancel</button>
              <button className="btn-delete" onClick={handleConfirmDelete} disabled={deleting} type="button">{deleting ? 'Deleting...' : 'Yes, Delete'}</button>
            </div>
          </div>
        </div>
      )}

      {messageToDelete && (
        <div className="modal-overlay" onClick={handleCancelMessageDelete}>
          <div className="modal-content delete-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>🗑️ Delete Message</h3></div>
            <div className="modal-body">
              <p>Remove this message permanently?</p>
              {messageToDelete.content && (
                <div className="delete-warning">
                  <p style={{ fontStyle: 'italic', color: '#667781', marginTop: 4 }}>
                    "{messageToDelete.content.length > 120 ? messageToDelete.content.slice(0, 120) + '…' : messageToDelete.content}"
                  </p>
                </div>
              )}
              <p className="warning-text" style={{ marginTop: 8 }}>⚠️ This cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={handleCancelMessageDelete} disabled={deletingMessage} type="button">Cancel</button>
              <button className="btn-delete" onClick={handleConfirmMessageDelete} disabled={deletingMessage} type="button">{deletingMessage ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      <div className="chat-content" style={{ display: 'flex', flexDirection: 'row' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div className="chat-messages" style={{ flex: 1 }}>
            {loading ? (
              <div className="empty-state"><div className="spinner"></div></div>
            ) : messages.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">💬</div>
                <h3>No messages yet</h3>
                <p>Start the conversation by sending a message</p>
              </div>
            ) : (
              <>
{groupedMessages.map((message, index) => {
  const msgKey = message.id || `msg-${index}`;
  // "Replied by" indicator — shown below each agent message group to all
  // logged-in employees (admins and agents). Customer widget never renders this.
const showRepliedBy = message.senderType === 'agent'
  && message.isLastInGroup
  && !message._optimistic
  && message.senderEmployeeName;


  return (
    <React.Fragment key={msgKey}>
      <MessageBubble
        message={message}
        nextMessage={index < groupedMessages.length - 1 ? groupedMessages[index + 1] : null}
        isAgent={message.senderType === 'agent'}
        isCustomer={message.senderType === 'customer'}
        showAvatar={true}
        isFirstInGroup={message.isFirstInGroup}
        isLastInGroup={message.isLastInGroup}
        sending={message.sending || message._optimistic}
        actionButton={
          isAdmin && !message._optimistic && message.senderType === 'agent' ? (
            <button
              type="button"
              onClick={() => handleDeleteMessageClick(message)}
              title="Delete message"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 13, color: '#ccc', padding: 0, lineHeight: 1,
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#e53e3e'}
              onMouseLeave={e => e.currentTarget.style.color = '#ccc'}
            >🗑️</button>
          ) : null
        }
      />
{showRepliedBy && (
  <div
    style={{
      textAlign: 'right',
      fontSize: '11px',
      color: '#8696a0',
      margin: '-2px 60px 8px 0',
      fontStyle: 'italic',
      fontWeight: 500,
      letterSpacing: '0.2px',
    }}
    title="Who actually sent this message (internal — not visible to the customer)"
  >
    Replied by {message.senderEmployeeName}
  </div>
)}
    </React.Fragment>
  );
})}
                {typingUsers.size > 0 && (
                  <div className="typing-indicator">
                    <div className="typing-indicator-avatar">{getInitials(Array.from(typingUsers)[0])}</div>
                    <div className="typing-indicator-bubble">
                      <div className="typing-dot"></div>
                      <div className="typing-dot"></div>
                      <div className="typing-dot"></div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {showCustomerInfo && (
            <CustomerInfo
              conversation={conversation}
              onClose={() => setShowCustomerInfo(false)}
              stores={stores}
            />
          )}
        </div>

        {showAISuggestions && (
          <AISuggestions
            conversation={conversation}
            messages={messages}
            onSelectSuggestion={handleSelectSuggestion}
          />
        )}
      </div>

      {filePreview && (
        <div style={{
          padding: '12px 16px', backgroundColor: '#f5f6f6',
          borderTop: '1px solid #e9edef', display: 'flex', alignItems: 'center', gap: '12px',
        }}>
          {filePreview.type === 'image' ? (
            <img src={filePreview.url} alt="Preview" style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px' }} />
          ) : (
            <div style={{ width: '60px', height: '60px', backgroundColor: '#00a884', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>📎</div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{filePreview.name}</div>
            {filePreview.size && <div style={{ fontSize: '12px', color: '#667781' }}>{filePreview.size}</div>}
          </div>
          {uploading && <div style={{ fontSize: '12px', color: '#00a884' }}>{uploadProgress}%</div>}
          <button
            onClick={handleRemoveFile} disabled={uploading} type="button"
            style={{ background: 'none', border: 'none', fontSize: '20px', cursor: uploading ? 'not-allowed' : 'pointer', color: '#667781', padding: '4px 8px' }}
          >✕</button>
        </div>
      )}

      <QuickReplies
        templates={templates}
        onUseTemplate={handleUseTemplate}
        onAddTemplate={handleAddQuickReply}
        onDeleteTemplate={handleDeleteQuickReply}
        onSaveTemplate={handleSaveQuickReply}
        loading={templateLoading}
        isOpen={showQuickReplies}
        onToggle={() => setShowQuickReplies(!showQuickReplies)}
      />

      <div style={{
        background: '#f0f2f5', padding: '12px 16px', borderTop: '1px solid #e9edef',
        display: 'flex', alignItems: 'flex-end', gap: '8px',
        flexShrink: 0, boxShadow: '0 -1px 2px rgba(11,20,26,0.05)', position: 'relative',
      }}>
        <button
          type="button"
          title="Quick replies"
          onClick={e => { e.preventDefault(); e.stopPropagation(); setShowQuickReplies(!showQuickReplies); }}
          style={{
            width: '40px', height: '40px', minWidth: '40px', flexShrink: 0,
            border: 'none', borderRadius: '50%', background: 'transparent',
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '20px', padding: 0,
            color: showQuickReplies ? '#00a884' : '#54656f',
          }}
        >⚡</button>

        <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
          {!messageText && (
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0,
              padding: '9px 12px', fontSize: '14px', lineHeight: '1.5',
              color: '#667781', pointerEvents: 'none', userSelect: 'none', zIndex: 1,
            }}>
              Type a message... (Ctrl+V to paste screenshot)
            </div>
          )}

          <div
            ref={editableRef}
            contentEditable={!sending && !uploading}
            suppressContentEditableWarning
            onInput={() => {
              const text = editableRef.current?.innerText || '';
              setMessageText(text);
              sendTypingIndicator(true);
              if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
              typingTimeoutRef.current = setTimeout(() => sendTypingIndicator(false), 2000);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); }
            }}
            onPaste={(e) => {
              const items = Array.from(e.clipboardData?.items || []);
              const hasImage = items.some(i => i.type.startsWith('image/'));
              if (hasImage) { e.preventDefault(); handlePaste(e); return; }
              e.preventDefault();
              const text = e.clipboardData.getData('text/plain');
              document.execCommand('insertText', false, text);
            }}
            style={{
              ...INPUT_STYLE,
              display: 'block',
              minHeight: '38px',
              maxHeight: '120px',
              overflowY: 'auto',
              outline: 'none',
              color: '#111b21',
              borderRadius: '8px',
              border: '1px solid #e9edef',
              background: '#fff',
              boxSizing: 'border-box',
              cursor: sending || uploading ? 'not-allowed' : 'text',
              opacity: sending || uploading ? 0.6 : 1,
            }}
          />

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.heic,.heif"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />

          {showEmojiPicker && (
            <EmojiPicker onSelect={handleEmojiSelect} onClose={() => setShowEmojiPicker(false)} />
          )}
        </div>

        <button
          type="button" title="Emoji"
          onClick={e => { e.preventDefault(); e.stopPropagation(); setShowEmojiPicker(v => !v); }}
          style={{
            width: '40px', height: '40px', minWidth: '40px', flexShrink: 0,
            border: 'none', borderRadius: '50%', background: 'transparent',
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '20px', padding: 0,
            color: showEmojiPicker ? '#00a884' : '#54656f',
          }}
        >😊</button>

        <button
          type="button" title="Attach file"
          onClick={handleAttachClick} disabled={uploading}
          style={{
            width: '40px', height: '40px', minWidth: '40px', flexShrink: 0,
            border: 'none', borderRadius: '50%', background: 'transparent',
            cursor: uploading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '20px', padding: 0,
            color: '#54656f',
          }}
        >{uploading ? '⏳' : '📎'}</button>

        <button
          type="button" title="Send message (Enter)"
          onClick={handleSend}
          disabled={(!messageText.trim() && !selectedFile) || sending || uploading}
          style={{
            width: '44px', height: '44px', minWidth: '44px', flexShrink: 0,
            border: 'none', borderRadius: '50%',
            background: (!messageText.trim() && !selectedFile) || sending || uploading
              ? 'rgba(0,168,132,0.4)' : '#00a884',
            cursor: (!messageText.trim() && !selectedFile) || sending || uploading
              ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '20px', padding: 0, color: 'white',
            boxShadow: '0 2px 6px rgba(0,168,132,0.3)',
          }}
        >{sending ? '⏳' : '➤'}</button>
      </div>

      <style>{`
        @keyframes legalSlideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to   { transform: translateY(0);     opacity: 1; }
        }
        @keyframes unreadToastIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-6px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes modalSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        [contenteditable]:empty:focus { outline: none; }
        [contenteditable] strong { font-weight: 700; }
        [contenteditable] em { font-style: italic; }
        [contenteditable] s { text-decoration: line-through; }
        [contenteditable] code {
          background: rgba(0,0,0,0.08);
          padding: 1px 5px;
          border-radius: 4px;
          font-size: 0.9em;
          font-family: monospace;
        }
      `}</style>
    </div>
  );
}

export default ChatWindow;