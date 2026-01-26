
import React, { useState, useEffect } from 'react';
import api from '../services/api';

function CustomerInfo({ conversation, onClose, stores }) { // ✅ Added stores prop
  const [customerData, setCustomerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadCustomerData();
  }, [conversation.id]);

  const loadCustomerData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await api.getCustomerContext(
        conversation.storeIdentifier,
        conversation.customerEmail
      );
      
      setCustomerData(data);
    } catch (error) {
      console.error('Failed to load customer data:', error);
      setError('Failed to load customer information');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Get store details from stores array
  const getStoreDetails = () => {
    if (!stores || !conversation) return null;
    
    const store = stores.find(s =>
      s.storeIdentifier === conversation.storeIdentifier ||
      s.id === conversation.shopId
    );
    
    return store || null;
  };

  const storeDetails = getStoreDetails();
  const storeName = storeDetails?.brandName || conversation.storeName || conversation.storeIdentifier;
  const storeDomain = storeDetails?.domain || storeDetails?.url || storeDetails?.storeDomain || null;

  const getInitials = (name) => {
    if (!name) return 'G';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatCurrency = (amount) => {
    if (!amount) return '0.00';
    return parseFloat(amount).toFixed(2);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="customer-info">
      {/* Header */}
      <div className="customer-info-header">
        <h3>Contact Info</h3>
        <button onClick={onClose} className="btn-close" aria-label="Close">
          ✕
        </button>
      </div>

      <div className="customer-info-content">
        {loading ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading customer info...</p>
          </div>
        ) : error ? (
          <div className="error-container">
            <p>{error}</p>
            <button onClick={loadCustomerData} className="retry-btn">
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* Avatar */}
            <div className="customer-info-avatar">
              {getInitials(customerData?.name || conversation.customerName)}
            </div>

            <div className="customer-name">
              {customerData?.name || conversation.customerName || 'Guest'}
            </div>

            {/* Contact Section */}
            <div className="info-section">
              <h4 className="section-title">CONTACT</h4>
              
              <div className="info-row">
                <span className="info-label">Email</span>
                <span className="info-value">
                  {customerData?.email || conversation.customerEmail || 'N/A'}
                </span>
              </div>
              
              {customerData?.phone && (
                <div className="info-row">
                  <span className="info-label">Phone</span>
                  <span className="info-value">{customerData.phone}</span>
                </div>
              )}
            </div>

            {/* Order Summary */}
            {customerData && (
              <div className="info-section">
                <h4 className="section-title">ORDER SUMMARY</h4>
                
                <div className="info-row">
                  <span className="info-label">Total Spent</span>
                  <span className="info-value-highlight">
                    ${formatCurrency(customerData.totalSpent)}
                  </span>
                </div>
                
                <div className="info-row">
                  <span className="info-label">Total Orders</span>
                  <span className="info-value">
                    {customerData.ordersCount || 0}
                  </span>
                </div>
              </div>
            )}

            {/* Recent Orders */}
            {customerData?.recentOrders && customerData.recentOrders.length > 0 && (
              <div className="info-section">
                <h4 className="section-title">RECENT ORDERS</h4>
                
                <div className="orders-list">
                  {customerData.recentOrders.slice(0, 5).map((order, index) => (
                    <div key={index} className="order-card">
                      <div className="order-top">
                        <span className="order-number">
                          #{order.orderNumber || order.name}
                        </span>
                        <span className="order-amount">
                          ${formatCurrency(order.totalPrice)}
                        </span>
                      </div>
                      
                      <div className="order-badges">
                        {order.financialStatus && (
                          <span className={`order-badge financial ${order.financialStatus.toLowerCase()}`}>
                            {order.financialStatus}
                          </span>
                        )}
                        {order.fulfillmentStatus && (
                          <span className={`order-badge fulfillment ${order.fulfillmentStatus.toLowerCase()}`}>
                            {order.fulfillmentStatus}
                          </span>
                        )}
                      </div>
                      
                      <div className="order-date">
                        {formatDate(order.createdAt)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Conversation Info */}
            <div className="info-section">
              <h4 className="section-title">CONVERSATION</h4>
              
              {/* ✅ Display store name and domain */}
              <div className="info-row">
                <span className="info-label">Store</span>
                <span className="info-value">
                  {storeName}
                  {storeDomain && (
                    <span className="store-domain"> ({storeDomain})</span>
                  )}
                </span>
              </div>
              
              <div className="info-row">
                <span className="info-label">Status</span>
                <span className={`badge status-${conversation.status}`}>
                  {conversation.status}
                </span>
              </div>
              
              <div className="info-row">
                <span className="info-label">Priority</span>
                <span className={`badge priority-${conversation.priority}`}>
                  {conversation.priority}
                </span>
              </div>
              
              {conversation.tags && conversation.tags.length > 0 && (
                <div className="info-row-vertical">
                  <span className="info-label">Tags</span>
                  <div className="tags-container">
                    {conversation.tags.map((tag, i) => (
                      <span key={i} className="tag">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            {customerData?.notes && (
              <div className="info-section">
                <h4 className="section-title">NOTES</h4>
                <p className="notes-text">{customerData.notes}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default CustomerInfo;