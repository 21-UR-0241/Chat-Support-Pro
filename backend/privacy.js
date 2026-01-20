// backend/privacy.js
const db = require('./database');

/**
 * Privacy Manager for GDPR Compliance
 * Handles data export and deletion requests
 */
class PrivacyManager {
  async handleDataRequest(storeId, customerEmail, type) {
    console.log(`🔒 Privacy request: ${type} for ${customerEmail} in store ${storeId}`);
    
    switch(type) {
      case 'export':
        return await this.exportCustomerData(storeId, customerEmail);
      case 'delete':
        return await this.deleteCustomerData(storeId, customerEmail);
      default:
        throw new Error('Invalid request type');
    }
  }
  
  async exportCustomerData(storeId, customerEmail) {
    try {
      // Get all conversations
      const conversations = await db.getConversations({
        storeId,
        customerEmail
      });
      
      // Get all messages for these conversations
      const allMessages = [];
      for (const conv of conversations) {
        const messages = await db.getMessages(conv.id);
        allMessages.push(...messages);
      }
      
      // Build export package
      const exportData = {
        customerEmail,
        storeId,
        exportedAt: new Date().toISOString(),
        conversations: conversations.map(c => ({
          id: c.id,
          status: c.status,
          createdAt: c.created_at,
          closedAt: c.closed_at
        })),
        messages: allMessages.map(m => ({
          id: m.id,
          conversationId: m.conversation_id,
          senderType: m.sender_type,
          content: m.content,
          sentAt: m.sent_at
        })),
        totalConversations: conversations.length,
        totalMessages: allMessages.length
      };
      
      console.log(`✅ Data exported for ${customerEmail}: ${allMessages.length} messages`);
      
      return exportData;
    } catch (error) {
      console.error('Error exporting customer data:', error);
      throw error;
    }
  }
  
  async deleteCustomerData(storeId, customerEmail) {
    try {
      const { pool } = require('./database');
      
      // Anonymize conversations (soft delete)
      await pool.query(`
        UPDATE conversations 
        SET customer_email = 'deleted@privacy.local',
            customer_name = 'Deleted User',
            customer_id = NULL,
            customer_phone = NULL
        WHERE shop_id = $1 AND customer_email = $2
      `, [storeId, customerEmail]);
      
      // Anonymize messages
      await pool.query(`
        UPDATE messages
        SET sender_name = 'Deleted User',
            sender_id = NULL
        WHERE shop_id = $1 
          AND conversation_id IN (
            SELECT id FROM conversations WHERE shop_id = $1 AND customer_email = $2
          )
          AND sender_type = 'customer'
      `, [storeId, customerEmail]);
      
      // Clear cache
      const redisManager = require('./redis-manager');
      await redisManager.invalidateCustomerContext(storeId, customerEmail);
      
      console.log(`✅ Data deleted for ${customerEmail}`);
      
      return { 
        success: true, 
        deletedAt: new Date().toISOString(),
        message: 'Customer data anonymized'
      };
    } catch (error) {
      console.error('Error deleting customer data:', error);
      throw error;
    }
  }
}

module.exports = new PrivacyManager();