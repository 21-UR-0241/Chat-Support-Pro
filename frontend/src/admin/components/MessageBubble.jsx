



// import React from 'react';

// function MessageBubble({
//   message,
//   isAgent = false,
//   showAvatar = true,
//   showSender = false,
//   sending = false,
//   isFirstInGroup = true,
//   isLastInGroup = true,
//   nextMessage = null,
//   actionButton = null,
// }) {
//   const formatTime = (date) => {
//     if (!date) return '';
//     try {
//       const messageDate = new Date(date);
//       return messageDate.toLocaleTimeString('en-US', {
//         hour: 'numeric',
//         minute: '2-digit',
//         hour12: true,
//       });
//     } catch (e) {
//       return '';
//     }
//   };

//   const formatDate = (date) => {
//     if (!date) return '';
//     try {
//       const messageDate = new Date(date);
//       const today = new Date();
//       const yesterday = new Date(today);
//       yesterday.setDate(yesterday.getDate() - 1);
//       const isToday = messageDate.toDateString() === today.toDateString();
//       const isYesterday = messageDate.toDateString() === yesterday.toDateString();
//       if (isToday) return 'Today';
//       if (isYesterday) return 'Yesterday';
//       return messageDate.toLocaleDateString('en-US', {
//         month: 'short',
//         day: 'numeric',
//         year: messageDate.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
//       });
//     } catch (e) {
//       return '';
//     }
//   };

//   const shouldShowDate = () => {
//     if (!message.timestamp && !message.createdAt && !message.created_at) return false;
//     if (!nextMessage) return true;
//     try {
//       const currentDate = new Date(message.timestamp || message.createdAt || message.created_at);
//       const nextDate = new Date(nextMessage.timestamp || nextMessage.createdAt || nextMessage.created_at);
//       return currentDate.toDateString() !== nextDate.toDateString();
//     } catch (e) {
//       return false;
//     }
//   };

//   const getInitials = (name) => {
//     if (!name) return isAgent ? 'A' : 'C';
//     return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
//   };

//   const parseFileData = (fileData) => {
//     if (!fileData) return null;
//     if (typeof fileData === 'object') return fileData;
//     try {
//       return JSON.parse(fileData);
//     } catch (e) {
//       return null;
//     }
//   };

//   const getFileType = (fileData) => {
//     if (!fileData) return null;
//     const type = fileData.type || fileData.contentType || '';
//     if (type.startsWith('image/')) return 'image';
//     if (type.startsWith('video/')) return 'video';
//     if (type === 'application/pdf') return 'pdf';
//     if (type.includes('word') || type.includes('document')) return 'document';
//     if (type.includes('sheet') || type.includes('excel')) return 'spreadsheet';
//     return 'file';
//   };

//   const getFileIcon = (fileType) => {
//     const icons = { image: '🖼️', video: '🎥', pdf: '📄', document: '📝', spreadsheet: '📊', file: '📎' };
//     return icons[fileType] || icons.file;
//   };

//   const formatFileSize = (bytes) => {
//     if (!bytes) return '';
//     if (bytes === 0) return '0 Bytes';
//     const k = 1024;
//     const sizes = ['Bytes', 'KB', 'MB', 'GB'];
//     const i = Math.floor(Math.log(bytes) / Math.log(k));
//     return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
//   };

//   const senderName = message.senderName || message.sender_name || (isAgent ? 'Agent' : 'Customer');
//   const messageTime = formatTime(message.timestamp || message.createdAt || message.created_at);
//   const messageDate = formatDate(message.timestamp || message.createdAt || message.created_at);
//   const showDate = shouldShowDate();

//   const rawFileData = message.fileData || message.file_data;
//   const fileData = parseFileData(rawFileData);
//   const fileType = getFileType(fileData);
//   const hasFile = message.fileUrl || fileData;
//   const fileUrl = fileData?.url || message.fileUrl;
//   const messageText = message.text || message.content || '';

//   const bubbleAndTime = (
//     <div className="message-bubble-wrapper">
//       <div className={`message-bubble ${isAgent ? 'agent' : 'customer'} ${sending ? 'sending' : ''} ${isFirstInGroup ? 'first' : ''} ${isLastInGroup ? 'last' : ''}`}>

//         {hasFile && fileData && fileUrl && (
//           <div className="message-attachment">
//             {fileType === 'image' ? (
//               <div className="attachment-image">
//                 <img
//                   src={fileUrl}
//                   alt={fileData.name || 'Image attachment'}
//                   onClick={() => window.open(fileUrl, '_blank')}
//                   style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px', cursor: 'pointer', display: 'block' }}
//                   onError={(e) => {
//                     e.target.style.display = 'none';
//                     e.target.parentElement.innerHTML = '<div style="padding:20px;text-align:center;color:#667781">Image failed to load</div>';
//                   }}
//                 />
//                 {fileData.name && (
//                   <div style={{ marginTop: '8px', fontSize: '13px', color: isAgent ? '#667781' : 'rgba(255,255,255,0.8)', wordBreak: 'break-word' }}>
//                     {fileData.name}
//                   </div>
//                 )}
//               </div>
//             ) : (
//               <a
//                 href={fileUrl}
//                 target="_blank"
//                 rel="noopener noreferrer"
//                 className="attachment-file"
//                 style={{
//                   display: 'flex', alignItems: 'center', gap: '12px', padding: '12px',
//                   backgroundColor: isAgent ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)',
//                   borderRadius: '8px', textDecoration: 'none', color: 'inherit',
//                   transition: 'background-color 0.2s', marginBottom: messageText ? '8px' : '0',
//                 }}
//                 onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isAgent ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.2)'; }}
//                 onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isAgent ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)'; }}
//               >
//                 <div style={{ fontSize: '28px' }}>{getFileIcon(fileType)}</div>
//                 <div style={{ flex: 1, minWidth: 0 }}>
//                   <div style={{ fontWeight: 500, marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '14px' }}>
//                     {fileData.name || 'Download file'}
//                   </div>
//                   {fileData.size && <div style={{ fontSize: '12px', opacity: 0.7 }}>{formatFileSize(fileData.size)}</div>}
//                 </div>
//                 <div style={{ fontSize: '18px', opacity: 0.7 }}>⬇</div>
//               </a>
//             )}
//           </div>
//         )}

//         {messageText && <div className="message-text">{messageText}</div>}
//       </div>

//       {/* Timestamp + status */}
//       <div className="message-datetime-header">
//         <span className="message-time">{messageTime}</span>
//         {showDate && messageDate && (
//           <>
//             <span className="datetime-separator">•</span>
//             <span className="message-date">{messageDate}</span>
//           </>
//         )}
//         {isAgent && (
//           <span className="message-status">
//             {sending ? (
//               <svg className="spinner-icon" width="12" height="12" viewBox="0 0 12 12">
//                 <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.25"/>
//                 <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="15.7" strokeDashoffset="15.7" className="spinner-circle"/>
//               </svg>
//             ) : (
//               <>
//                 {(!message.status || message.status === 'sent') && (
//                   <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
//                     <path d="M4.5 8.5L6.5 10.5L11.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
//                   </svg>
//                 )}
//                 {message.status === 'delivered' && (
//                   <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
//                     <path d="M2 8.5L4 10.5L9 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
//                     <path d="M6 8.5L8 10.5L13 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
//                   </svg>
//                 )}
//                 {message.status === 'read' && (
//                   <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
//                     <path d="M2 8.5L4 10.5L9 5.5" stroke="#34B7F1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
//                     <path d="M6 8.5L8 10.5L13 5.5" stroke="#34B7F1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
//                   </svg>
//                 )}
//               </>
//             )}
//           </span>
//         )}
//       </div>
//     </div>
//   );

//   return (
//     <div className={`message-row ${isAgent ? 'agent' : 'customer'} ${isFirstInGroup ? 'first-in-group' : ''} ${isLastInGroup ? 'last-in-group' : ''}`}>

//       {/* ── CUSTOMER: no delete button, ever ── */}
//       {!isAgent && (
//         <div className="message-container">
//           {isFirstInGroup
//             ? <div className="message-avatar">{getInitials(senderName)}</div>
//             : <div className="message-avatar-spacer"></div>
//           }
//           {bubbleAndTime}
//         </div>
//       )}

// {isAgent && (
//   <div className="agent-message-outer">
//     {/* Bubble FIRST */}
//     <div className="message-container">
//       {bubbleAndTime}
//     </div>
//     {/* Delete button AFTER, on the right */}
//     {actionButton && (
//       <button
//         type="button"
//         className="agent-delete-btn"
//         onClick={actionButton.props.onClick}
//         title={actionButton.props.title}
//       >
//         {actionButton.props.children}
//       </button>
//     )}
//   </div>
// )}

//     </div>
//   );
// }

// export default MessageBubble;



import React from 'react';

function MessageBubble({
  message,
  isAgent = false,
  showAvatar = true,
  showSender = false,
  sending = false,
  isFirstInGroup = true,
  isLastInGroup = true,
  nextMessage = null,
  actionButton = null,
}) {
  const formatTime = (date) => {
    if (!date) return '';
    try {
      const messageDate = new Date(date);
      return messageDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch (e) {
      return '';
    }
  };

  const formatDate = (date) => {
    if (!date) return '';
    try {
      const messageDate = new Date(date);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const isToday = messageDate.toDateString() === today.toDateString();
      const isYesterday = messageDate.toDateString() === yesterday.toDateString();
      if (isToday) return 'Today';
      if (isYesterday) return 'Yesterday';
      return messageDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: messageDate.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
      });
    } catch (e) {
      return '';
    }
  };

  const shouldShowDate = () => {
    if (!message.timestamp && !message.createdAt && !message.created_at) return false;
    if (!nextMessage) return true;
    try {
      const currentDate = new Date(message.timestamp || message.createdAt || message.created_at);
      const nextDate = new Date(nextMessage.timestamp || nextMessage.createdAt || nextMessage.created_at);
      return currentDate.toDateString() !== nextDate.toDateString();
    } catch (e) {
      return false;
    }
  };

  const getInitials = (name) => {
    if (!name) return isAgent ? 'A' : 'C';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // FIX: parseFileData handles string, object, or null safely
  const parseFileData = (fileData) => {
    if (!fileData) return null;
    if (typeof fileData === 'object') return fileData;
    try {
      return JSON.parse(fileData);
    } catch (e) {
      return null;
    }
  };

  const getFileType = (fileData, fileUrl) => {
    // Try to detect from fileData.type first
    if (fileData) {
      const type = fileData.type || fileData.contentType || '';
      if (type.startsWith('image/')) return 'image';
      if (type.startsWith('video/')) return 'video';
      if (type === 'application/pdf') return 'pdf';
      if (type.includes('word') || type.includes('document')) return 'document';
      if (type.includes('sheet') || type.includes('excel')) return 'spreadsheet';
    }
    // FIX: fallback — detect image by URL extension when fileData.type is missing
    if (fileUrl && /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i.test(fileUrl)) return 'image';
    if (fileUrl && /\.(mp4|mov|avi|webm)(\?.*)?$/i.test(fileUrl)) return 'video';
    if (fileUrl && /\.pdf(\?.*)?$/i.test(fileUrl)) return 'pdf';
    return 'file';
  };

  const getFileIcon = (fileType) => {
    const icons = { image: '🖼️', video: '🎥', pdf: '📄', document: '📝', spreadsheet: '📊', file: '📎' };
    return icons[fileType] || icons.file;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const senderName = message.senderName || message.sender_name || (isAgent ? 'Agent' : 'Customer');
  const messageTime = formatTime(message.timestamp || message.createdAt || message.created_at);
  const messageDate = formatDate(message.timestamp || message.createdAt || message.created_at);
  const showDate = shouldShowDate();

  const rawFileData = message.fileData || message.file_data;
  const fileData = parseFileData(rawFileData);

  // FIX: resolve fileUrl from multiple possible sources
  const fileUrl = fileData?.url || message.fileUrl || message.file_url || null;

  // FIX: hasFile is true if we have any URL — fileData is no longer required
  const hasFile = !!fileUrl;

  // FIX: pass fileUrl into getFileType so URL-based extension detection works
  const fileType = getFileType(fileData, fileUrl);

  const messageText = message.text || message.content || '';

  const renderAttachment = () => {
    if (!hasFile) return null;

    if (fileType === 'image') {
      return (
        <div className="message-attachment">
          <div className="attachment-image">
            <img
              src={fileUrl}
              alt={fileData?.name || 'Image attachment'}
              onClick={() => window.open(fileUrl, '_blank')}
              style={{
                maxWidth: '100%',
                maxHeight: '300px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'block',
              }}
              onError={(e) => {
                e.target.style.display = 'none';
                if (e.target.parentElement) {
                  e.target.parentElement.innerHTML =
                    '<div style="padding:20px;text-align:center;color:#667781">Image failed to load</div>';
                }
              }}
            />
            {fileData?.name && (
              <div style={{
                marginTop: '8px',
                fontSize: '13px',
                color: isAgent ? '#667781' : 'rgba(255,255,255,0.8)',
                wordBreak: 'break-word',
              }}>
                {fileData.name}
              </div>
            )}
          </div>
        </div>
      );
    }

    // Non-image file — render as download link
    return (
      <div className="message-attachment">
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="attachment-file"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px',
            backgroundColor: isAgent ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)',
            borderRadius: '8px',
            textDecoration: 'none',
            color: 'inherit',
            transition: 'background-color 0.2s',
            marginBottom: messageText ? '8px' : '0',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = isAgent ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = isAgent ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)';
          }}
        >
          <div style={{ fontSize: '28px' }}>{getFileIcon(fileType)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontWeight: 500,
              marginBottom: '2px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: '14px',
            }}>
              {fileData?.name || 'Download file'}
            </div>
            {fileData?.size && (
              <div style={{ fontSize: '12px', opacity: 0.7 }}>{formatFileSize(fileData.size)}</div>
            )}
          </div>
          <div style={{ fontSize: '18px', opacity: 0.7 }}>⬇</div>
        </a>
      </div>
    );
  };

  const bubbleAndTime = (
    <div className="message-bubble-wrapper">
      <div className={[
        'message-bubble',
        isAgent ? 'agent' : 'customer',
        sending ? 'sending' : '',
        isFirstInGroup ? 'first' : '',
        isLastInGroup ? 'last' : '',
      ].filter(Boolean).join(' ')}>

        {renderAttachment()}
        {messageText && <div className="message-text">{messageText}</div>}
      </div>

      {/* Timestamp + status */}
      <div className="message-datetime-header">
        <span className="message-time">{messageTime}</span>
        {showDate && messageDate && (
          <>
            <span className="datetime-separator">•</span>
            <span className="message-date">{messageDate}</span>
          </>
        )}
        {isAgent && (
          <span className="message-status">
            {sending ? (
              <svg className="spinner-icon" width="12" height="12" viewBox="0 0 12 12">
                <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.25"/>
                <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="15.7" strokeDashoffset="15.7" className="spinner-circle"/>
              </svg>
            ) : (
              <>
                {(!message.status || message.status === 'sent') && (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M4.5 8.5L6.5 10.5L11.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
                {message.status === 'delivered' && (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M2 8.5L4 10.5L9 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M6 8.5L8 10.5L13 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
                {message.status === 'read' && (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M2 8.5L4 10.5L9 5.5" stroke="#34B7F1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M6 8.5L8 10.5L13 5.5" stroke="#34B7F1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </>
            )}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className={[
      'message-row',
      isAgent ? 'agent' : 'customer',
      isFirstInGroup ? 'first-in-group' : '',
      isLastInGroup ? 'last-in-group' : '',
    ].filter(Boolean).join(' ')}>

      {/* ── CUSTOMER ── */}
      {!isAgent && (
        <div className="message-container">
          {isFirstInGroup
            ? <div className="message-avatar">{getInitials(senderName)}</div>
            : <div className="message-avatar-spacer"></div>
          }
          {bubbleAndTime}
        </div>
      )}

      {/* ── AGENT ── */}
      {isAgent && (
        <div className="agent-message-outer">
          <div className="message-container">
            {bubbleAndTime}
          </div>
          {/* FIX: render actionButton directly instead of reaching into .props */}
          {actionButton && (
            <div className="agent-action-btn-wrapper">
              {actionButton}
            </div>
          )}
        </div>
      )}

    </div>
  );
}

export default MessageBubble;