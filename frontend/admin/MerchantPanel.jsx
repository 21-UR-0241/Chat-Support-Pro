import React, { useState, useEffect, useRef } from 'react';
import { Search, Send, User, ShoppingBag, DollarSign, Clock, CheckCircle, AlertCircle } from 'lucide-react';

function MerchantPanel({ apiUrl, wsUrl, shopDomain }) {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [customerContext, setCustomerContext] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  
  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // WebSocket connection
  const connectWebSocket = () => {
    try {
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('WebSocket connected');
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'message' && data.data) {
            // Update messages if this conversation is selected
            if (selectedConversation && data.data.conversation_id === selectedConversation.id) {
              setMessages(prev => {
                const exists = prev.some(m => m.id === data.data.id);
                if (exists) return prev;
                return [...prev, data.data];
              });
            }
            
            // Refresh conversation list
            loadConversations();
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
      ws.onclose = () => {
        console.log('WebSocket disconnected, reconnecting...');
        setTimeout(connectWebSocket, 3000);
      };
      
      wsRef.current = ws;
    } catch (error) {
      console.error('Error connecting WebSocket:', error);
    }
  };

  // Load all conversations
  const loadConversations = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/conversations`, {
        headers: {
          'X-Shop-Domain': shopDomain,
        },
      });
      
      if (!response.ok) throw new Error('Failed to load conversations');
      
      const data = await response.json();
      setConversations(data);
      setLoading(false);
    } catch (error) {
      console.error('Error loading conversations:', error);
      setLoading(false);
    }
  };

  // Select and load a conversation
  const selectConversation = async (conversation) => {
    setSelectedConversation(conversation);
    
    try {
      // Load conversation messages
      const messagesResponse = await fetch(
        `${apiUrl}/api/conversations/${conversation.id}`,
        {
          headers: {
            'X-Shop-Domain': shopDomain,
          },
        }
      );
      
      if (!messagesResponse.ok) throw new Error('Failed to load messages');
      
      const data = await messagesResponse.json();
      setMessages(data.messages || []);
      
      // Join this conversation via WebSocket
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'join',
          conversationId: conversation.id
        }));
      }
      
      // Load customer context if customer_id exists
      if (conversation.customer_id) {
        loadCustomerContext(conversation.customer_id);
      } else {
        setCustomerContext(null);
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
    }
  };

  // Load customer context from Shopify
  const loadCustomerContext = async (customerId) => {
    try {
      const response = await fetch(
        `${apiUrl}/api/customers/${customerId}/context`,
        {
          headers: {
            'X-Shop-Domain': shopDomain,
          },
        }
      );
      
      if (!response.ok) throw new Error('Failed to load customer context');
      
      const data = await response.json();
      setCustomerContext(data);
    } catch (error) {
      console.error('Error loading customer context:', error);
      setCustomerContext(null);
    }
  };

  // Send message
  const sendMessage = async (e) => {
    e.preventDefault();
    
    if (!messageInput.trim() || !selectedConversation) {
      return;
    }
    
    const messageContent = messageInput.trim();
    setMessageInput('');
    
    // Optimistically add message to UI
    const tempMessage = {
      id: Date.now(),
      conversation_id: selectedConversation.id,
      sender_type: 'merchant',
      sender_name: 'Support',
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
          conversation_id: selectedConversation.id,
          sender_type: 'merchant',
          sender_name: 'Support',
          content: messageContent,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to send message');
      
      const savedMessage = await response.json();
      
      // Update the temp message with the real one
      setMessages(prev => prev.map(m => 
        m.id === tempMessage.id ? savedMessage : m
      ));
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => prev.filter(m => m.id !== tempMessage.id));
      alert('Failed to send message');
    }
  };

  // Filter conversations by search query
  const filteredConversations = conversations.filter(conv => 
    conv.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.customer_email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Format helpers
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      {/* Left Sidebar - Conversations List */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Live Chat</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-500">Loading...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {searchQuery ? 'No conversations found' : 'No conversations yet'}
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => selectConversation(conv)}
                className={`p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedConversation?.id === conv.id ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-semibold text-gray-800">
                    {conv.customer_name || conv.customer_email}
                  </h3>
                  <span className="text-xs text-gray-500">
                    {formatDate(conv.created_at)}
                  </span>
                </div>
                <p className="text-sm text-gray-600 truncate mb-2">
                  {conv.customer_email}
                </p>
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    conv.status === 'open' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {conv.status}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatTime(conv.updated_at)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Center - Chat Messages */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
              <h2 className="text-xl font-semibold text-gray-800">
                {selectedConversation.customer_name || selectedConversation.customer_email}
              </h2>
              <p className="text-sm text-gray-600">{selectedConversation.customer_email}</p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((message, index) => (
                <div
                  key={message.id || index}
                  className={`flex ${message.sender_type === 'merchant' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] px-4 py-3 rounded-lg shadow-sm ${
                      message.sender_type === 'merchant'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-800 border border-gray-200'
                    }`}
                  >
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="font-semibold text-sm">
                        {message.sender_name}
                      </span>
                      <span className={`text-xs ${
                        message.sender_type === 'merchant' ? 'text-blue-200' : 'text-gray-500'
                      }`}>
                        {formatTime(message.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed">{message.content}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <form onSubmit={sendMessage} className="bg-white border-t border-gray-200 px-6 py-4">
              <div className="flex items-center space-x-3">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                <button
                  type="submit"
                  disabled={!messageInput.trim()}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <Send className="w-5 h-5" />
                  <span>Send</span>
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <User className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p className="text-lg">Select a conversation to start chatting</p>
            </div>
          </div>
        )}
      </div>

      {/* Right Sidebar - Customer Context */}
      {selectedConversation && (
        <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Customer Info</h3>
            
            {/* Customer Details */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800">
                    {selectedConversation.customer_name || 'Customer'}
                  </p>
                  <p className="text-sm text-gray-600">
                    {selectedConversation.customer_email}
                  </p>
                </div>
              </div>
            </div>

            {/* Customer Context from Shopify */}
            {customerContext ? (
              <>
                <div className="space-y-4 mb-6">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <ShoppingBag className="w-5 h-5 text-gray-600" />
                      <span className="text-sm text-gray-600">Orders</span>
                    </div>
                    <span className="font-semibold text-gray-800">
                      {customerContext.customer.orders_count || 0}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <DollarSign className="w-5 h-5 text-gray-600" />
                      <span className="text-sm text-gray-600">Total Spent</span>
                    </div>
                    <span className="font-semibold text-gray-800">
                      ${customerContext.customer.total_spent || '0.00'}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-5 h-5 text-gray-600" />
                      <span className="text-sm text-gray-600">Customer Since</span>
                    </div>
                    <span className="text-sm text-gray-800">
                      {new Date(customerContext.customer.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Recent Orders */}
                <div>
                  <h4 className="font-semibold text-gray-800 mb-3">Recent Orders</h4>
                  <div className="space-y-3">
                    {customerContext.orders && customerContext.orders.length > 0 ? (
                      customerContext.orders.slice(0, 5).map((order) => (
                        <div key={order.id} className="border border-gray-200 rounded-lg p-3">
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-medium text-sm">#{order.order_number}</span>
                            <span className="font-semibold text-sm">${order.total_price}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            {order.financial_status === 'paid' ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-yellow-600" />
                            )}
                            <span className="text-xs text-gray-600">
                              {new Date(order.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">No orders yet</p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center text-gray-500 py-8">
                <p className="text-sm">No customer data available</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default MerchantPanel;
