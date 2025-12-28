// /**
//  * CustomerInfo Component
//  * Shows customer details and Shopify order history
//  */

// import React, { useState, useEffect } from 'react';
// import api from '../services/api';

// function CustomerInfo({ conversation, onClose }) {
//   const [customerData, setCustomerData] = useState(null);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     loadCustomerData();
//   }, [conversation.id]);

//   const loadCustomerData = async () => {
//     try {
//       setLoading(true);
      
//       // Fetch customer context from Shopify
//       const data = await api.getCustomerContext(
//         conversation.storeIdentifier,
//         conversation.customerEmail
//       );
      
//       setCustomerData(data);
//     } catch (error) {
//       console.error('Failed to load customer data:', error);
//     } finally {
//       setLoading(false);
//     }
//   };

//   if (loading) {
//     return (
//       <div className="customer-info">
//         <div className="customer-info-header">
//           <h3>Customer Info</h3>
//           <button onClick={onClose} className="btn-close">×</button>
//         </div>
//         <div className="loading">Loading customer data...</div>
//       </div>
//     );
//   }

//   return (
//     <div className="customer-info">
//       {/* Header */}
//       <div className="customer-info-header">
//         <h3>Customer Info</h3>
//         <button onClick={onClose} className="btn-close">×</button>
//       </div>

//       {/* Customer Details */}
//       <div className="customer-info-section">
//         <h4>Contact</h4>
//         <div className="info-item">
//           <span className="info-label">Name:</span>
//           <span className="info-value">{customerData?.name || conversation.customerName || 'N/A'}</span>
//         </div>
//         <div className="info-item">
//           <span className="info-label">Email:</span>
//           <span className="info-value">{customerData?.email || conversation.customerEmail}</span>
//         </div>
//         {customerData?.phone && (
//           <div className="info-item">
//             <span className="info-label">Phone:</span>
//             <span className="info-value">{customerData.phone}</span>
//           </div>
//         )}
//       </div>

//       {/* Order Summary */}
//       {customerData && (
//         <div className="customer-info-section">
//           <h4>Order Summary</h4>
//           <div className="info-item">
//             <span className="info-label">Total Spent:</span>
//             <span className="info-value highlight">${customerData.totalSpent || '0.00'}</span>
//           </div>
//           <div className="info-item">
//             <span className="info-label">Total Orders:</span>
//             <span className="info-value">{customerData.ordersCount || 0}</span>
//           </div>
//         </div>
//       )}

//       {/* Recent Orders */}
//       {customerData?.recentOrders && customerData.recentOrders.length > 0 && (
//         <div className="customer-info-section">
//           <h4>Recent Orders</h4>
//           <div className="recent-orders">
//             {customerData.recentOrders.map((order, index) => (
//               <div key={index} className="order-item">
//                 <div className="order-header">
//                   <span className="order-number">#{order.orderNumber || order.name}</span>
//                   <span className="order-amount">${order.totalPrice}</span>
//                 </div>
//                 <div className="order-status">
//                   <span className={`status-badge ${order.financialStatus}`}>
//                     {order.financialStatus}
//                   </span>
//                   <span className={`status-badge ${order.fulfillmentStatus || 'unfulfilled'}`}>
//                     {order.fulfillmentStatus || 'unfulfilled'}
//                   </span>
//                 </div>
//                 <div className="order-date">
//                   {new Date(order.createdAt).toLocaleDateString()}
//                 </div>
//               </div>
//             ))}
//           </div>
//         </div>
//       )}

//       {/* Conversation Meta */}
//       <div className="customer-info-section">
//         <h4>Conversation</h4>
//         <div className="info-item">
//           <span className="info-label">Store:</span>
//           <span className="info-value">{conversation.storeIdentifier}</span>
//         </div>
//         <div className="info-item">
//           <span className="info-label">Status:</span>
//           <span className={`status-badge ${conversation.status}`}>
//             {conversation.status}
//           </span>
//         </div>
//         <div className="info-item">
//           <span className="info-label">Priority:</span>
//           <span className={`status-badge ${conversation.priority}`}>
//             {conversation.priority}
//           </span>
//         </div>
//         {conversation.tags && conversation.tags.length > 0 && (
//           <div className="info-item">
//             <span className="info-label">Tags:</span>
//             <div className="tags">
//               {conversation.tags.map((tag, i) => (
//                 <span key={i} className="tag">{tag}</span>
//               ))}
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

// export default CustomerInfo;


/**
 * CustomerInfo Component
 * Shows customer details and Shopify order history
 */

import React, { useState, useEffect } from 'react';
import api from '../services/api';

function CustomerInfo({ conversation, onClose }) {
  const [customerData, setCustomerData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCustomerData();
  }, [conversation.id]);

  const loadCustomerData = async () => {
    try {
      setLoading(true);
      
      // Fetch customer context from Shopify
      const data = await api.getCustomerContext(
        conversation.storeIdentifier,
        conversation.customerEmail
      );
      
      setCustomerData(data);
    } catch (error) {
      console.error('Failed to load customer data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get initials from name
  const getInitials = (name) => {
    if (!name) return 'G';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Format currency
  const formatCurrency = (amount) => {
    if (!amount) return '0.00';
    return parseFloat(amount).toFixed(2);
  };

  if (loading) {
    return (
      <div className="customer-info">
        <div className="customer-info-header">
          <h3>Customer Info</h3>
          <button onClick={onClose} className="btn-close">×</button>
        </div>
        <div className="customer-info-content">
          <div className="empty-state">
            <div className="spinner"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="customer-info">
      {/* Header */}
      <div className="customer-info-header">
        <h3>Customer Info</h3>
        <button onClick={onClose} className="btn-close">×</button>
      </div>

      <div className="customer-info-content">
        {/* Customer Avatar */}
        <div className="customer-info-avatar">
          {getInitials(customerData?.name || conversation.customerName)}
        </div>

        {/* Contact Details */}
        <div className="customer-info-section">
          <h4>Contact</h4>
          <div className="info-item">
            <span className="info-label">Name:</span>
            <span className="info-value">
              {customerData?.name || conversation.customerName || 'N/A'}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Email:</span>
            <span className="info-value">
              {customerData?.email || conversation.customerEmail}
            </span>
          </div>
          {customerData?.phone && (
            <div className="info-item">
              <span className="info-label">Phone:</span>
              <span className="info-value">{customerData.phone}</span>
            </div>
          )}
        </div>

        {/* Order Summary */}
        {customerData && (
          <div className="customer-info-section">
            <h4>Order Summary</h4>
            <div className="info-item">
              <span className="info-label">Total Spent:</span>
              <span className="info-value highlight">
                ${formatCurrency(customerData.totalSpent)}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Total Orders:</span>
              <span className="info-value">{customerData.ordersCount || 0}</span>
            </div>
          </div>
        )}

        {/* Recent Orders */}
        {customerData?.recentOrders && customerData.recentOrders.length > 0 && (
          <div className="customer-info-section">
            <h4>Recent Orders</h4>
            <div className="recent-orders">
              {customerData.recentOrders.map((order, index) => (
                <div key={index} className="order-item">
                  <div className="order-header">
                    <span className="order-number">
                      #{order.orderNumber || order.name}
                    </span>
                    <span className="order-amount">
                      ${formatCurrency(order.totalPrice)}
                    </span>
                  </div>
                  <div className="order-status">
                    <span className={`status-badge ${order.financialStatus?.toLowerCase()}`}>
                      {order.financialStatus}
                    </span>
                    <span className={`status-badge ${order.fulfillmentStatus?.toLowerCase() || 'unfulfilled'}`}>
                      {order.fulfillmentStatus || 'unfulfilled'}
                    </span>
                  </div>
                  <div className="order-date">
                    {new Date(order.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Conversation Meta */}
        <div className="customer-info-section">
          <h4>Conversation</h4>
          <div className="info-item">
            <span className="info-label">Store:</span>
            <span className="info-value">{conversation.storeIdentifier}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Status:</span>
            <span className={`status-tag ${conversation.status}`}>
              {conversation.status}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Priority:</span>
            <span className={`priority-tag ${conversation.priority}`}>
              {conversation.priority}
            </span>
          </div>
          {conversation.tags && conversation.tags.length > 0 && (
            <div className="info-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <span className="info-label">Tags:</span>
              <div className="tags">
                {conversation.tags.map((tag, i) => (
                  <span key={i} className="tag">{tag}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Notes (if available) */}
        {customerData?.notes && (
          <div className="customer-info-section">
            <h4>Notes</h4>
            <p className="info-notes">{customerData.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default CustomerInfo;