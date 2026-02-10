

// import React from 'react';

// function MessageBubble({
//   message,
//   isAgent = false,
//   showAvatar = true,
//   showSender = false,
//   sending = false,
//   isFirstInGroup = true,
//   isLastInGroup = true,
// }) {
//   // Format time - WhatsApp style
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

//   // Get initials from sender name
//   const getInitials = (name) => {
//     if (!name) return isAgent ? 'A' : 'C';
//     return name
//       .split(' ')
//       .map((n) => n[0])
//       .join('')
//       .toUpperCase()
//       .slice(0, 2);
//   };

//   // Parse file data - handles both object and JSON string
//   const parseFileData = (fileData) => {
//     if (!fileData) return null;
//     if (typeof fileData === 'object') return fileData;
//     try {
//       return JSON.parse(fileData);
//     } catch (e) {
//       console.error('Failed to parse file data:', e);
//       return null;
//     }
//   };

//   // Get file type from MIME type
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

//   // Get file icon emoji
//   const getFileIcon = (fileType) => {
//     const icons = {
//       image: '🖼️',
//       video: '🎥',
//       pdf: '📄',
//       document: '📝',
//       spreadsheet: '📊',
//       file: '📎',
//     };
//     return icons[fileType] || icons.file;
//   };

//   // Format file size
//   const formatFileSize = (bytes) => {
//     if (!bytes) return '';
//     if (bytes === 0) return '0 Bytes';
//     const k = 1024;
//     const sizes = ['Bytes', 'KB', 'MB', 'GB'];
//     const i = Math.floor(Math.log(bytes) / Math.log(k));
//     return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
//   };

//   const senderName = message.senderName || message.sender_name || (isAgent ? 'Agent' : 'Customer');
//   const messageText = message.text || message.content || '';
//   const messageTime = formatTime(message.timestamp || message.createdAt || message.created_at);
  
//   // ✅ FIX: Check both camelCase (from WebSocket) and snake_case (from database)
//   const rawFileData = message.fileData || message.file_data;
//   const fileData = parseFileData(rawFileData);
//   const fileType = getFileType(fileData);
//   const hasFile = message.fileUrl || fileData;
//   const fileUrl = fileData?.url || message.fileUrl;

//   // Debug log to see what we're getting
//   if (hasFile) {
//     console.log('📎 Message with file:', {
//       messageId: message.id,
//       hasRawFileData: !!rawFileData,
//       rawFileDataType: typeof rawFileData,
//       parsedFileData: fileData,
//       fileUrl: fileUrl,
//       fileType: fileType
//     });
//   }

//   return (
//     <div className={`message-row ${isAgent ? 'agent' : 'customer'} ${isFirstInGroup ? 'first-in-group' : ''} ${isLastInGroup ? 'last-in-group' : ''}`}>
//       <div className="message-container">
//         {/* Avatar - only show for first message in group */}
//         {!isAgent && isFirstInGroup && (
//           <div className="message-avatar">
//             {getInitials(senderName)}
//           </div>
//         )}
        
//         {/* Spacer when no avatar */}
//         {!isAgent && !isFirstInGroup && (
//           <div className="message-avatar-spacer"></div>
//         )}

//         {/* Message Bubble */}
//         <div className={`message-bubble ${isAgent ? 'agent' : 'customer'} ${sending ? 'sending' : ''} ${isFirstInGroup ? 'first' : ''} ${isLastInGroup ? 'last' : ''}`}>
          
//           {/* File Attachment */}
//           {hasFile && fileData && fileUrl && (
//             <div className="message-attachment">
//               {fileType === 'image' ? (
//                 <div className="attachment-image">
//                   <img 
//                     src={fileUrl} 
//                     alt={fileData.name || 'Image attachment'}
//                     onClick={() => window.open(fileUrl, '_blank')}
//                     style={{ 
//                       maxWidth: '100%',
//                       maxHeight: '300px',
//                       borderRadius: '8px',
//                       cursor: 'pointer',
//                       display: 'block',
//                     }}
//                     onError={(e) => {
//                       console.error('❌ Failed to load image:', fileUrl);
//                       e.target.style.display = 'none';
//                       e.target.parentElement.innerHTML = '<div style="padding: 20px; text-align: center; color: #667781;">Image failed to load</div>';
//                     }}
//                     onLoad={() => {
//                       console.log('✅ Image loaded successfully:', fileUrl);
//                     }}
//                   />
//                   {fileData.name && (
//                     <div style={{ 
//                       marginTop: '8px', 
//                       fontSize: '13px', 
//                       color: isAgent ? '#667781' : 'rgba(255,255,255,0.8)',
//                       wordBreak: 'break-word'
//                     }}>
//                       {fileData.name}
//                     </div>
//                   )}
//                 </div>
//               ) : (
//                 <a 
//                   href={fileUrl} 
//                   target="_blank" 
//                   rel="noopener noreferrer"
//                   className="attachment-file"
//                   style={{
//                     display: 'flex',
//                     alignItems: 'center',
//                     gap: '12px',
//                     padding: '12px',
//                     backgroundColor: isAgent ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.1)',
//                     borderRadius: '8px',
//                     textDecoration: 'none',
//                     color: 'inherit',
//                     transition: 'background-color 0.2s',
//                     marginBottom: messageText ? '8px' : '0',
//                   }}
//                   onMouseEnter={(e) => {
//                     e.currentTarget.style.backgroundColor = isAgent 
//                       ? 'rgba(0, 0, 0, 0.1)' 
//                       : 'rgba(255, 255, 255, 0.2)';
//                   }}
//                   onMouseLeave={(e) => {
//                     e.currentTarget.style.backgroundColor = isAgent 
//                       ? 'rgba(0, 0, 0, 0.05)' 
//                       : 'rgba(255, 255, 255, 0.1)';
//                   }}
//                 >
//                   <div style={{ fontSize: '28px' }}>
//                     {getFileIcon(fileType)}
//                   </div>
//                   <div style={{ flex: 1, minWidth: 0 }}>
//                     <div style={{ 
//                       fontWeight: 500, 
//                       marginBottom: '2px',
//                       overflow: 'hidden',
//                       textOverflow: 'ellipsis',
//                       whiteSpace: 'nowrap',
//                       fontSize: '14px',
//                     }}>
//                       {fileData.name || 'Download file'}
//                     </div>
//                     {fileData.size && (
//                       <div style={{ 
//                         fontSize: '12px', 
//                         opacity: 0.7 
//                       }}>
//                         {formatFileSize(fileData.size)}
//                       </div>
//                     )}
//                   </div>
//                   <div style={{ fontSize: '18px', opacity: 0.7 }}>
//                     ⬇
//                   </div>
//                 </a>
//               )}
//             </div>
//           )}

//           {/* Message Text */}
//           {messageText && (
//             <div className="message-text">{messageText}</div>
//           )}

//           {/* Time and Status Row */}
//           <div className="message-time-row">
//             <span className="message-time">{messageTime}</span>
            
//             {/* Status indicators for agent messages */}
//             {isAgent && (
//               <span className="message-status">
//                 {sending ? (
//                   <svg className="spinner-icon" width="12" height="12" viewBox="0 0 12 12">
//                     <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.25"/>
//                     <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="15.7" strokeDashoffset="15.7" className="spinner-circle"/>
//                   </svg>
//                 ) : (
//                   <>
//                     {(!message.status || message.status === 'sent') && (
//                       <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
//                         <path d="M4.5 8.5L6.5 10.5L11.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
//                       </svg>
//                     )}
//                     {message.status === 'delivered' && (
//                       <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
//                         <path d="M2 8.5L4 10.5L9 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
//                         <path d="M6 8.5L8 10.5L13 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
//                       </svg>
//                     )}
//                     {message.status === 'read' && (
//                       <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
//                         <path d="M2 8.5L4 10.5L9 5.5" stroke="#34B7F1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
//                         <path d="M6 8.5L8 10.5L13 5.5" stroke="#34B7F1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
//                       </svg>
//                     )}
//                   </>
//                 )}
//               </span>
//             )}
//           </div>
//         </div>
//       </div>
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
  nextMessage = null, // Add this prop to check the next message
}) {
  // Format time only
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

  // Format date
  const formatDate = (date) => {
    if (!date) return '';
    
    try {
      const messageDate = new Date(date);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      // Check if message is from today
      const isToday = messageDate.toDateString() === today.toDateString();
      const isYesterday = messageDate.toDateString() === yesterday.toDateString();
      
      if (isToday) {
        return 'Today';
      } else if (isYesterday) {
        return 'Yesterday';
      } else {
        return messageDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: messageDate.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
        });
      }
    } catch (e) {
      return '';
    }
  };

  // Check if we should show the date (when day changes or last message)
  const shouldShowDate = () => {
    if (!message.timestamp && !message.createdAt && !message.created_at) {
      return false;
    }

    // If there's no next message, show date (last message)
    if (!nextMessage) {
      return true;
    }

    try {
      const currentDate = new Date(message.timestamp || message.createdAt || message.created_at);
      const nextDate = new Date(nextMessage.timestamp || nextMessage.createdAt || nextMessage.created_at);
      
      // Show date if the next message is from a different day
      return currentDate.toDateString() !== nextDate.toDateString();
    } catch (e) {
      return false;
    }
  };

  // Get initials from sender name
  const getInitials = (name) => {
    if (!name) return isAgent ? 'A' : 'C';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Parse file data - handles both object and JSON string
  const parseFileData = (fileData) => {
    if (!fileData) return null;
    if (typeof fileData === 'object') return fileData;
    try {
      return JSON.parse(fileData);
    } catch (e) {
      console.error('Failed to parse file data:', e);
      return null;
    }
  };

  // Get file type from MIME type
  const getFileType = (fileData) => {
    if (!fileData) return null;
    
    const type = fileData.type || fileData.contentType || '';
    
    if (type.startsWith('image/')) return 'image';
    if (type.startsWith('video/')) return 'video';
    if (type === 'application/pdf') return 'pdf';
    if (type.includes('word') || type.includes('document')) return 'document';
    if (type.includes('sheet') || type.includes('excel')) return 'spreadsheet';
    
    return 'file';
  };

  // Get file icon emoji
  const getFileIcon = (fileType) => {
    const icons = {
      image: '🖼️',
      video: '🎥',
      pdf: '📄',
      document: '📝',
      spreadsheet: '📊',
      file: '📎',
    };
    return icons[fileType] || icons.file;
  };

  // Format file size
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
  
  // ✅ FIX: Check both camelCase (from WebSocket) and snake_case (from database)
  const rawFileData = message.fileData || message.file_data;
  const fileData = parseFileData(rawFileData);
  const fileType = getFileType(fileData);
  const hasFile = message.fileUrl || fileData;
  const fileUrl = fileData?.url || message.fileUrl;
  const messageText = message.text || message.content || '';

  // Debug log to see what we're getting
  if (hasFile) {
    console.log('📎 Message with file:', {
      messageId: message.id,
      hasRawFileData: !!rawFileData,
      rawFileDataType: typeof rawFileData,
      parsedFileData: fileData,
      fileUrl: fileUrl,
      fileType: fileType
    });
  }

  return (
    <div className={`message-row ${isAgent ? 'agent' : 'customer'} ${isFirstInGroup ? 'first-in-group' : ''} ${isLastInGroup ? 'last-in-group' : ''}`}>
      <div className="message-container">
        {/* Avatar - only show for first message in group */}
        {!isAgent && isFirstInGroup && (
          <div className="message-avatar">
            {getInitials(senderName)}
          </div>
        )}
        
        {/* Spacer when no avatar */}
        {!isAgent && !isFirstInGroup && (
          <div className="message-avatar-spacer"></div>
        )}

        {/* Wrapper for bubble + datetime */}
        <div className="message-bubble-wrapper">
          {/* Message Bubble */}
          <div className={`message-bubble ${isAgent ? 'agent' : 'customer'} ${sending ? 'sending' : ''} ${isFirstInGroup ? 'first' : ''} ${isLastInGroup ? 'last' : ''}`}>
            
            {/* File Attachment */}
            {hasFile && fileData && fileUrl && (
              <div className="message-attachment">
                {fileType === 'image' ? (
                  <div className="attachment-image">
                    <img 
                      src={fileUrl} 
                      alt={fileData.name || 'Image attachment'}
                      onClick={() => window.open(fileUrl, '_blank')}
                      style={{ 
                        maxWidth: '100%',
                        maxHeight: '300px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'block',
                      }}
                      onError={(e) => {
                        console.error('❌ Failed to load image:', fileUrl);
                        e.target.style.display = 'none';
                        e.target.parentElement.innerHTML = '<div style="padding: 20px; text-align: center; color: #667781;">Image failed to load</div>';
                      }}
                      onLoad={() => {
                        console.log('✅ Image loaded successfully:', fileUrl);
                      }}
                    />
                    {fileData.name && (
                      <div style={{ 
                        marginTop: '8px', 
                        fontSize: '13px', 
                        color: isAgent ? '#667781' : 'rgba(255,255,255,0.8)',
                        wordBreak: 'break-word'
                      }}>
                        {fileData.name}
                      </div>
                    )}
                  </div>
                ) : (
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
                      backgroundColor: isAgent ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      textDecoration: 'none',
                      color: 'inherit',
                      transition: 'background-color 0.2s',
                      marginBottom: messageText ? '8px' : '0',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = isAgent 
                        ? 'rgba(0, 0, 0, 0.1)' 
                        : 'rgba(255, 255, 255, 0.2)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = isAgent 
                        ? 'rgba(0, 0, 0, 0.05)' 
                        : 'rgba(255, 255, 255, 0.1)';
                    }}
                  >
                    <div style={{ fontSize: '28px' }}>
                      {getFileIcon(fileType)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ 
                        fontWeight: 500, 
                        marginBottom: '2px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontSize: '14px',
                      }}>
                        {fileData.name || 'Download file'}
                      </div>
                      {fileData.size && (
                        <div style={{ 
                          fontSize: '12px', 
                          opacity: 0.7 
                        }}>
                          {formatFileSize(fileData.size)}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: '18px', opacity: 0.7 }}>
                      ⬇
                    </div>
                  </a>
                )}
              </div>
            )}

            {/* Message Text */}
            {messageText && (
              <div className="message-text">{messageText}</div>
            )}
          </div>

          {/* Time and Date - BELOW the bubble */}
          <div className="message-datetime-header">
            {/* Always show time */}
            <span className="message-time">{messageTime}</span>
            
            {/* Show date only at day boundaries */}
            {showDate && messageDate && (
              <>
                <span className="datetime-separator">•</span>
                <span className="message-date">{messageDate}</span>
              </>
            )}
            
            {/* Status indicators for agent messages */}
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
      </div>
    </div>
  );
}

export default MessageBubble;