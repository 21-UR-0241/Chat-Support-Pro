import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Minimize2 } from 'lucide-react';

function ChatWidget({ apiUrl, wsUrl, shopDomain, widgetColor = '#667eea', welcomeMessage = 'Hi! How can we help?' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [conversationStarted, setConversationStarted] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [initialMessage, setInitialMessage] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  
  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // WebSocket connection
  const connectWebSocket = (convId) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        ws.send(JSON.stringify({
          type: 'join',
          conversationId: convId
        }));
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'message' && data.data) {
            setMessages(prev => {
              // Avoid duplicates
              const exists = prev.some(m => m.id === data.data.id);
              if (exists) return prev;
              return [...prev, data.data];
            });
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
      ws.onclose = () => {
        console.log('WebSocket disconnected');
        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          if (conversationId) {
            connectWebSocket(conversationId);
          }
        }, 3000);
      };
      
      wsRef.current = ws;
    } catch (error) {
      console.error('Error connecting WebSocket:', error);
    }
  };

  useEffect(() => {
    if (conversationId) {
      connectWebSocket(conversationId);
    }
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [conversationId]);

  // Start conversation
  const startConversation = async (e) => {
    e.preventDefault();
    
    if (!customerEmail || !initialMessage) {
      alert('Please fill in all fields');
      return;
    }
    
    setIsConnecting(true);
    
    try {
      const response = await fetch(`${apiUrl}/api/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shop-Domain': shopDomain,
        },
        body: JSON.stringify({
          customer_email: customerEmail,
          customer_name: customerName || customerEmail,
          initial_message: initialMessage,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to start conversation');
      }
      
      const conversation = await response.json();
      setConversationId(conversation.id);
      setConversationStarted(true);
      
      // Add initial message to local state
      setMessages([{
        id: Date.now(),
        sender_type: 'customer',
        sender_name: customerName || customerEmail,
        content: initialMessage,
        timestamp: new Date().toISOString(),
      }]);
      
      setInitialMessage('');
    } catch (error) {
      console.error('Error starting conversation:', error);
      alert('Failed to start conversation. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  // Send message
  const sendMessage = async (e) => {
    e.preventDefault();
    
    if (!messageInput.trim() || !conversationId) {
      return;
    }
    
    const messageContent = messageInput.trim();
    setMessageInput('');
    
    // Optimistically add message to UI
    const tempMessage = {
      id: Date.now(),
      conversation_id: conversationId,
      sender_type: 'customer',
      sender_name: customerName || customerEmail,
      content: messageContent,
      timestamp: new Date().toISOString(),
    };
    
    setMessages(prev => [...prev, tempMessage]);
    
    try {
      const response = await fetch(`${apiUrl}/api/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shop-Domain': shopDomain,
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          sender_type: 'customer',
          sender_name: customerName || customerEmail,
          content: messageContent,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to send message');
      }
      
      const savedMessage = await response.json();
      
      // Update the temp message with the real one
      setMessages(prev => prev.map(m => 
        m.id === tempMessage.id ? savedMessage : m
      ));
    } catch (error) {
      console.error('Error sending message:', error);
      // Remove the failed message
      setMessages(prev => prev.filter(m => m.id !== tempMessage.id));
      alert('Failed to send message. Please try again.');
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 font-sans">
      {!isOpen ? (
        // Floating button
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center justify-center w-16 h-16 rounded-full shadow-2xl transition-all duration-300 hover:scale-110"
          style={{ 
            background: `linear-gradient(135deg, ${widgetColor} 0%, ${widgetColor}dd 100%)` 
          }}
        >
          <MessageCircle className="w-7 h-7 text-white" />
          <span className="absolute -top-1 -right-1 flex h-5 w-5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500"></span>
          </span>
        </button>
      ) : (
        // Chat window
        <div className="flex flex-col bg-white rounded-2xl shadow-2xl w-96 h-[600px] max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div 
            className="flex items-center justify-between px-6 py-4 text-white rounded-t-2xl"
            style={{ 
              background: `linear-gradient(135deg, ${widgetColor} 0%, ${widgetColor}dd 100%)` 
            }}
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <MessageCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Live Chat</h3>
                <p className="text-sm text-white text-opacity-90">We're here to help!</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
            >
              <Minimize2 className="w-5 h-5" />
            </button>
          </div>

          {!conversationStarted ? (
            // Welcome screen
            <div className="flex-1 flex flex-col justify-center px-6 py-8">
              <div className="text-center mb-6">
                <h4 className="text-2xl font-bold text-gray-800 mb-2">
                  {welcomeMessage}
                </h4>
                <p className="text-gray-600">
                  Fill in the form below and we'll get back to you right away!
                </p>
              </div>
              
              <form onSubmit={startConversation} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name (optional)
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Your name"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-opacity-50 focus:outline-none transition-all"
                    style={{ focusRing: widgetColor }}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-opacity-50 focus:outline-none transition-all"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Message <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={initialMessage}
                    onChange={(e) => setInitialMessage(e.target.value)}
                    placeholder="How can we help you?"
                    required
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-opacity-50 focus:outline-none resize-none transition-all"
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={isConnecting}
                  className="w-full py-3 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50"
                  style={{ 
                    background: `linear-gradient(135deg, ${widgetColor} 0%, ${widgetColor}dd 100%)` 
                  }}
                >
                  {isConnecting ? 'Starting Chat...' : 'Start Chat'}
                </button>
              </form>
            </div>
          ) : (
            // Chat interface
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-gray-50">
                {messages.map((message, index) => (
                  <div
                    key={message.id || index}
                    className={`flex ${message.sender_type === 'customer' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] px-4 py-3 rounded-2xl shadow-sm ${
                        message.sender_type === 'customer'
                          ? 'text-white rounded-br-none'
                          : 'bg-white text-gray-800 rounded-bl-none'
                      }`}
                      style={
                        message.sender_type === 'customer'
                          ? { background: `linear-gradient(135deg, ${widgetColor} 0%, ${widgetColor}dd 100%)` }
                          : {}
                      }
                    >
                      <p className="text-sm leading-relaxed">{message.content}</p>
                      <p className={`text-xs mt-1 ${
                        message.sender_type === 'customer' ? 'text-white text-opacity-70' : 'text-gray-500'
                      }`}>
                        {new Date(message.timestamp).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <form onSubmit={sendMessage} className="px-4 py-4 bg-white border-t border-gray-200">
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-full focus:ring-2 focus:ring-opacity-50 focus:outline-none transition-all"
                  />
                  <button
                    type="submit"
                    disabled={!messageInput.trim()}
                    className="p-3 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ 
                      background: `linear-gradient(135deg, ${widgetColor} 0%, ${widgetColor}dd 100%)` 
                    }}
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default ChatWidget;
