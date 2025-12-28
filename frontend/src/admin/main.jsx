import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';
import './styles/App.css';
import './styles/ConversationList.css';
import './styles/ChatWindow.css';
import './styles/MessageBubble.css';
import './styles/CustomerInfo.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);