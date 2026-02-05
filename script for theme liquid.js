{%- comment -%}
============================================
CHAT WIDGET - CUSTOMER & CART DATA CAPTURE
============================================
Auto-detects customer email and cart info for seamless chat experience
Works on all Shopify plans (no checkout.liquid access needed)
Data persists for 30 days to support return customers
{%- endcomment -%}

{%- comment -%} ⭐ CONFIGURATION - CHANGE THESE VALUES {%- endcomment -%}
{%- assign chat_store_id = 'hc4ajx-c0' -%}
{%- assign chat_api_url = 'https://chat-support-pro.onrender.com' -%}

{%- comment -%} LOGGED-IN CUSTOMER DATA {%- endcomment -%}
{% if customer %}
<script>
  // Pass customer data to widget for immediate use
  window.chatCustomerData = {
    email: {{ customer.email | json }},
    name: {{ customer.name | json }},
    firstName: {{ customer.first_name | json }},
    lastName: {{ customer.last_name | json }},
    id: {{ customer.id | json }},
    ordersCount: {{ customer.orders_count | json }},
    totalSpent: {{ customer.total_spent | money_without_currency | json }}
  };
  
  // Store in localStorage for persistence across pages
  try {
    localStorage.setItem('chat_email_{{ chat_store_id }}', {{ customer.email | json }});
    localStorage.setItem('chat_name_{{ chat_store_id }}', {{ customer.name | json }});
    localStorage.setItem('chat_customer_data', JSON.stringify(window.chatCustomerData));
    console.log('✅ [Chat Widget] Customer auto-detected:', {{ customer.email | json }});
  } catch (e) {
    console.error('Failed to store customer data:', e);
  }
</script>
{% endif %}

{%- comment -%} CART DATA {%- endcomment -%}
{% if cart.item_count > 0 %}
<script>
  // Pass cart data to widget
  window.chatCartData = {
    subtotal: {{ cart.total_price | money_without_currency | json }},
    itemCount: {{ cart.item_count | json }},
    currency: {{ cart.currency.iso_code | json }},
    items: {{ cart.items | json }}
  };
  
  // Store in localStorage for persistence
  try {
    localStorage.setItem('chat_cart_data', JSON.stringify(window.chatCartData));
    console.log('🛒 [Chat Widget] Cart data captured:', {{ cart.item_count | json }}, 'items, ${{ cart.total_price | money_without_currency }}');
  } catch (e) {}
  
  // Combine customer + cart for checkout context
  {% if customer %}
  try {
    const checkoutData = {
      email: {{ customer.email | json }},
      name: {{ customer.name | json }},
      firstName: {{ customer.first_name | json }},
      subtotal: {{ cart.total_price | money_without_currency | json }},
      itemCount: {{ cart.item_count | json }},
      currency: {{ cart.currency.iso_code | json }},
      items: {{ cart.items | json }},
      timestamp: Date.now()
    };
    localStorage.setItem('chat_checkout_data', JSON.stringify(checkoutData));
    window.chatCheckoutData = checkoutData;
    console.log('✅ [Chat Widget] Checkout context prepared');
  } catch (e) {}
  {% endif %}
</script>
{% endif %}

{%- comment -%} ORDER DATA - Thank You Page ONLY {%- endcomment -%}
{% if template.name == 'order' or template == 'customers/order' %}
  {% if order %}
  <script>
    (function() {
      const orderData = {
        email: {{ order.email | json }},
        name: {{ order.customer.name | default: order.billing_address.name | json }},
        firstName: {{ order.customer.first_name | default: order.billing_address.first_name | json }},
        phone: {{ order.phone | default: order.billing_address.phone | json }},
        orderId: {{ order.id | json }},
        orderNumber: {{ order.order_number | json }},
        total: {{ order.total_price | money_without_currency | json }},
        subtotal: {{ order.subtotal_price | money_without_currency | json }},
        itemCount: {{ order.line_items.size | json }},
        currency: {{ order.currency | json }},
        orderDate: {{ order.created_at | date: "%Y-%m-%d %H:%M" | json }},
        financialStatus: {{ order.financial_status | json }},
        fulfillmentStatus: {{ order.fulfillment_status | default: "unfulfilled" | json }},
        timestamp: Date.now(),
        items: {{ order.line_items | json }}
      };
      
      if (orderData.email && /\S+@\S+\.\S+/.test(orderData.email)) {
        try {
          // Save for widget auto-detection (30-day persistence)
          localStorage.setItem('chat_checkout_data', JSON.stringify(orderData));
          localStorage.setItem('chat_recent_order', JSON.stringify(orderData));
          localStorage.setItem('chat_last_order_time', Date.now().toString());
          
          // Use consistent keys with manual entry
          localStorage.setItem('chat_email_{{ chat_store_id }}', orderData.email);
          localStorage.setItem('chat_name_{{ chat_store_id }}', orderData.name || orderData.firstName || '');
          
          // Backward compatibility keys
          localStorage.setItem('chat_customer_email', orderData.email);
          localStorage.setItem('chat_customer_name', orderData.name || orderData.firstName || '');
          
          window.chatCheckoutData = orderData;
          
          console.log('✅ [Thank You Page] Order #' + orderData.orderNumber + ' data captured');
        } catch (e) {
          console.error('Failed to save order data:', e);
        }
      }
    })();
  </script>
  {% endif %}
{% endif %}

{%- comment -%} WIDGET INITIALIZATION {%- endcomment -%}
<script>
  window.ChatSupportConfig = {
    storeId: '{{ chat_store_id }}',
    apiUrl: '{{ chat_api_url }}'
  };
</script>
<script src="{{ chat_api_url }}/widget-init.js" defer></script>