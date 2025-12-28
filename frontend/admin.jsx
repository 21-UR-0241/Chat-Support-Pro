import React from 'react';
import ReactDOM from 'react-dom/client';
import MerchantPanel from './admin/MerchantPanel.jsx';

// Get shop domain from URL or localStorage
const urlParams = new URLSearchParams(window.location.search);
let shopDomain = urlParams.get('shop');

if (!shopDomain) {
  shopDomain = localStorage.getItem('shopDomain');
}

if (!shopDomain) {
  shopDomain = prompt('Enter your shop domain (e.g., demo-store.myshopify.com):') || 'demo-store.myshopify.com';
  localStorage.setItem('shopDomain', shopDomain);
}

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <MerchantPanel 
    apiUrl="http://localhost:3000"
    wsUrl="ws://localhost:3000/ws"
    shopDomain={shopDomain}
  />
);