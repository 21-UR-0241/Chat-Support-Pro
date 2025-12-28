/**
 * Shopify API - Minimal version
 */

// Placeholder for now - will add Shopify integration later
const getCustomerContext = async (storeId, customerEmail) => {
  // For now, return mock data
  return {
    name: customerEmail,
    email: customerEmail,
    phone: null,
    totalSpent: '0.00',
    ordersCount: 0,
    recentOrders: [],
  };
};

module.exports = {
  getCustomerContext,
};