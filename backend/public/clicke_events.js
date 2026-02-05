// Email capture for chat widget
analytics.subscribe("checkout_contact_info_submitted", (event) => {
  const email = event.data?.checkout?.email;
  if (email && /\S+@\S+\.\S+/.test(email)) {
    console.log('✅ [Checkout] Email:', email);
    
    try {
      localStorage.setItem('chat_customer_email', email);
      localStorage.setItem('chat_customer_name', 
        event.data?.checkout?.shippingAddress?.firstName || '');
    } catch (e) {}
    
    fetch('https://chat-support-pro.onrender.com/api/customer/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: '0nrr62-s0',
        email: email,
        source: 'checkout',
        timestamp: new Date().toISOString()
      })
    }).catch(() => {});
  }
});

analytics.subscribe("checkout_completed", (event) => {
  const checkout = event.data?.checkout;
  if (checkout?.email) {
    console.log('✅ [Order Complete] Email:', checkout.email);
    
    const orderData = {
      email: checkout.email,
      name: checkout.shippingAddress?.firstName || '',
      orderId: checkout.order?.id,
      orderTotal: checkout.totalPrice?.amount
    };
    
    try {
      localStorage.setItem('chat_customer_email', orderData.email);
      localStorage.setItem('chat_customer_name', orderData.name);
      localStorage.setItem('chat_customer_data', JSON.stringify(orderData));
      localStorage.setItem('chat_last_order_time', Date.now().toString());
    } catch (e) {}
    
    fetch('https://chat-support-pro.onrender.com/api/customer/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: '0nrr62-s0',
        ...orderData,
        source: 'order_complete'
      })
    }).catch(() => {});
  }
});