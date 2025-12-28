import React from 'react';
import ReactDOM from 'react-dom/client';
import ChatWidget from './widget/ChatWidget.jsx';

// Get shop domain from the widget embed script or data attribute
const widgetElement = document.getElementById('shopify-chat-widget');
const shopDomain = widgetElement?.dataset.shop || 'demo-store.myshopify.com';

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <ChatWidget 
    apiUrl="http://localhost:3000"
    wsUrl="ws://localhost:3000/ws"
    shopDomain={shopDomain}
  />
);