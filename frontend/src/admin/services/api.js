
// const API_URL = import.meta.env.PROD 
//   ? import.meta.env.VITE_API_URL || 'https://chat-support-pro.onrender.com'
//   : '';

// class ApiService {
//   constructor() {
//     this.baseUrl = API_URL;
//   }

//   getToken() {
//     return localStorage.getItem('token');
//   }

//   handleUnauthorized() {
//     console.log('🚨 UNAUTHORIZED - Clearing session');
//     localStorage.removeItem('token');
//     localStorage.removeItem('employee');
//     sessionStorage.setItem('auth_error', 'Session expired. Please login again.');
//     window.location.reload();
//   }

//   async fetch(endpoint, options = {}) {
//     const url = `${this.baseUrl}${endpoint}`;
//     const token = this.getToken();
    
//     const defaultOptions = {
//       headers: {
//         'Content-Type': 'application/json',
//         ...(token && { 'Authorization': `Bearer ${token}` }),
//         ...options.headers,
//       },
//     };

//     try {
//       const response = await fetch(url, { ...defaultOptions, ...options });
      
//       if (response.status === 401) {
//         this.handleUnauthorized();
//         throw new Error('Session expired. Please login again.');
//       }

//       if (response.status === 403) {
//         throw new Error('Access denied. You do not have permission.');
//       }
      
//       if (!response.ok) {
//         const error = await response.json().catch(() => ({ error: 'Request failed' }));
//         throw new Error(error.error || error.message || 'API request failed');
//       }

//       return await response.json();
//     } catch (error) {
//       console.error('API Error:', error);
//       throw error;
//     }
//   }

//   async uploadFile(formData, onUploadProgress) {
//     return new Promise((resolve, reject) => {
//       const xhr = new XMLHttpRequest();
//       const url = `${this.baseUrl}/api/files/upload`;
//       const token = this.getToken();

//       if (onUploadProgress) {
//         xhr.upload.addEventListener('progress', (e) => {
//           if (e.lengthComputable) {
//             onUploadProgress({ loaded: e.loaded, total: e.total });
//           }
//         });
//       }

//       xhr.addEventListener('load', () => {
//         if (xhr.status === 200 || xhr.status === 201) {
//           try {
//             resolve(JSON.parse(xhr.responseText));
//           } catch (error) {
//             reject(new Error('Failed to parse upload response'));
//           }
//         } else if (xhr.status === 401) {
//           this.handleUnauthorized();
//           reject(new Error('Session expired. Please login again.'));
//         } else {
//           try {
//             const error = JSON.parse(xhr.responseText);
//             reject(new Error(error.message || error.error || 'File upload failed'));
//           } catch (e) {
//             reject(new Error('File upload failed'));
//           }
//         }
//       });

//       xhr.addEventListener('error', () => reject(new Error('Network error during file upload')));
//       xhr.addEventListener('abort', () => reject(new Error('File upload was cancelled')));

//       xhr.open('POST', url);
//       if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
//       xhr.send(formData);
//     });
//   }

//   async deleteFile(fileName) {
//     return this.fetch(`/api/files/${fileName}`, { method: 'DELETE' });
//   }

//   // ============ Authentication ============

//   async login(email, password) {
//     return this.fetch('/api/employees/login', {
//       method: 'POST',
//       body: JSON.stringify({ email, password }),
//     });
//   }

//   async logout() {
//     try {
//       await this.fetch('/api/employees/logout', { method: 'POST' });
//     } catch (error) {
//       console.error('Logout error:', error);
//     } finally {
//       localStorage.removeItem('token');
//       localStorage.removeItem('employee');
//     }
//   }

//   async verifyToken() {
//     return this.fetch('/api/auth/verify');
//   }

//   // ============ Conversations ============

//   async getConversations(filters = {}) {
//     const params = new URLSearchParams(filters).toString();
//     return this.fetch(`/api/conversations${params ? '?' + params : ''}`);
//   }

//   async getConversation(id) {
//     return this.fetch(`/api/conversations/${id}`);
//   }

//   async createConversation(data) {
//     return this.fetch('/api/conversations', {
//       method: 'POST',
//       body: JSON.stringify(data),
//     });
//   }

//   async updateConversation(id, updates) {
//     return this.fetch(`/api/conversations/${id}`, {
//       method: 'PUT',
//       body: JSON.stringify(updates),
//     });
//   }

//   async closeConversation(id) {
//     return this.fetch(`/api/conversations/${id}/close`, { method: 'PUT' });
//   }

//   async markConversationRead(id) {
//     return this.fetch(`/api/conversations/${id}/read`, { method: 'PUT' });
//   }

//   async markConversationUnread(id) {
//     return this.fetch(`/api/conversations/${id}/unread`, { method: 'PUT' });
//   }

//   // ============ Cross-Store History ============

//   async getLinkedConversations(email, excludeConversationId = null) {
//     const params = excludeConversationId
//       ? `?excludeConversationId=${excludeConversationId}`
//       : '';
//     return this.fetch(
//       `/api/conversations/linked/${encodeURIComponent(email)}${params}`
//     );
//   }

//   // ============ Messages ============

//   async getMessages(conversationId) {
//     return this.fetch(`/api/conversations/${conversationId}/messages`);
//   }

//   async sendMessage(data) {
//     return this.fetch('/api/messages', {
//       method: 'POST',
//       body: JSON.stringify(data),
//     });
//   }

//   async deleteMessage(messageId) {
//     return this.fetch(`/api/messages/${messageId}`, { method: 'DELETE' });
//   }

//   // ============ Stores ============

//   async getStores() {
//     return this.fetch('/api/stores');
//   }

//   async getStore(id) {
//     return this.fetch(`/api/stores/${id}`);
//   }

//   // ============ Customer Context ============

//   async getCustomerContext(storeId, email) {
//     return this.fetch(`/api/customer-context/${storeId}/${encodeURIComponent(email)}`);
//   }

//   async getCustomerById(id, storeId) {
//     return this.fetch(`/api/customers/${id}/context?storeId=${storeId}`);
//   }

//   // ============ Stats ============

//   async getDashboardStats(filters = {}) {
//     const params = new URLSearchParams(filters).toString();
//     return this.fetch(`/api/stats/dashboard${params ? '?' + params : ''}`);
//   }

//   async getWebSocketStats() {
//     return this.fetch('/api/stats/websocket');
//   }

//   // ============ Analytics ============

//   async getCommonQuestions(params = {}) {
//     const queryParams = new URLSearchParams(params).toString();
//     return this.fetch(`/api/analytics/common-questions${queryParams ? '?' + queryParams : ''}`);
//   }

//   async clearAnalyticsCache() {
//     return this.fetch('/api/analytics/clear-cache', { method: 'POST' });
//   }

//   // ============ Employees ============

//   async getEmployees() {
//     return this.fetch('/api/employees');
//   }

//   async getEmployee(email) {
//     return this.fetch(`/api/employees/${encodeURIComponent(email)}`);
//   }

//   async createEmployee(data) {
//     return this.fetch('/api/employees', {
//       method: 'POST',
//       body: JSON.stringify(data),
//     });
//   }

//   async updateEmployee(id, data) {
//     return this.fetch(`/api/employees/${id}`, {
//       method: 'PUT',
//       body: JSON.stringify(data),
//     });
//   }

//   async deleteEmployee(id) {
//     return this.fetch(`/api/employees/${id}`, { method: 'DELETE' });
//   }

//   async updateEmployeeStatus(id, status) {
//     return this.fetch(`/api/employees/${id}/status`, {
//       method: 'PUT',
//       body: JSON.stringify({ status }),
//     });
//   }

//   // ============ Message Templates ============

//   async getTemplates() {
//     return this.fetch('/api/templates');
//   }

//   async createTemplate(data) {
//     return this.fetch('/api/templates', {
//       method: 'POST',
//       body: JSON.stringify(data),
//     });
//   }

//   async updateTemplate(id, data) {
//     return this.fetch(`/api/templates/${id}`, {
//       method: 'PUT',
//       body: JSON.stringify(data),
//     });
//   }

//   async deleteTemplate(id) {
//     return this.fetch(`/api/templates/${id}`, { method: 'DELETE' });
//   }

//   // ============ Conversation Notes ============

//   async getConversationNotes(conversationId) {
//     return this.fetch(`/api/conversations/${conversationId}/notes`);
//   }

//   async getEmployeeNotes(employeeId) {
//     return this.fetch(`/api/employees/${employeeId}/notes`);
//   }

//   async createNote(data) {
//     return this.fetch('/api/conversation-notes', {
//       method: 'POST',
//       body: JSON.stringify(data),
//     });
//   }

//   async deleteNote(noteId) {
//     return this.fetch(`/api/conversation-notes/${noteId}`, { method: 'DELETE' });
//   }

//   // ============ Email ============

//   async sendEmail({ to, subject, body, conversationId, customerName }) {
//     return this.fetch('/api/email/send', {
//       method: 'POST',
//       body: JSON.stringify({ to, subject, body, conversationId, customerName }),
//     });
//   }

//   // ============ Health Check ============

//   async healthCheck() {
//     return this.fetch('/health');
//   }
// }

// export default new ApiService();



const API_URL = import.meta.env.PROD 
  ? import.meta.env.VITE_API_URL || 'https://chat-support-pro.onrender.com'
  : '';

class ApiService {
  constructor() {
    this.baseUrl = API_URL;
  }

  getToken() {
    return localStorage.getItem('token');
  }

  handleUnauthorized() {
    console.log('🚨 UNAUTHORIZED - Clearing session');
    localStorage.removeItem('token');
    localStorage.removeItem('employee');
    sessionStorage.setItem('auth_error', 'Session expired. Please login again.');
    window.location.reload();
  }

  async fetch(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const token = this.getToken();
    
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, { ...defaultOptions, ...options });
      
      if (response.status === 401) {
        this.handleUnauthorized();
        throw new Error('Session expired. Please login again.');
      }

      if (response.status === 403) {
        throw new Error('Access denied. You do not have permission.');
      }
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || error.message || 'API request failed');
      }

      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  async uploadFile(formData, onUploadProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const url = `${this.baseUrl}/api/files/upload`;
      const token = this.getToken();

      if (onUploadProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            onUploadProgress({ loaded: e.loaded, total: e.total });
          }
        });
      }

      xhr.addEventListener('load', () => {
        if (xhr.status === 200 || xhr.status === 201) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch (error) {
            reject(new Error('Failed to parse upload response'));
          }
        } else if (xhr.status === 401) {
          this.handleUnauthorized();
          reject(new Error('Session expired. Please login again.'));
        } else {
          try {
            const error = JSON.parse(xhr.responseText);
            reject(new Error(error.message || error.error || 'File upload failed'));
          } catch (e) {
            reject(new Error('File upload failed'));
          }
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Network error during file upload')));
      xhr.addEventListener('abort', () => reject(new Error('File upload was cancelled')));

      xhr.open('POST', url);
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.send(formData);
    });
  }

  async deleteFile(fileName) {
    return this.fetch(`/api/files/${fileName}`, { method: 'DELETE' });
  }

  // ============ Authentication ============

  async login(email, password) {
    return this.fetch('/api/employees/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async logout() {
    try {
      await this.fetch('/api/employees/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('employee');
    }
  }

  async verifyToken() {
    return this.fetch('/api/auth/verify');
  }

  // ============ Conversations ============

  async getConversations(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return this.fetch(`/api/conversations${params ? '?' + params : ''}`);
  }

  async getConversation(id) {
    return this.fetch(`/api/conversations/${id}`);
  }

  async createConversation(data) {
    return this.fetch('/api/conversations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateConversation(id, updates) {
    return this.fetch(`/api/conversations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async closeConversation(id) {
    return this.fetch(`/api/conversations/${id}/close`, { method: 'PUT' });
  }

  async markConversationRead(id) {
    return this.fetch(`/api/conversations/${id}/read`, { method: 'PUT' });
  }

  async markConversationUnread(id) {
    return this.fetch(`/api/conversations/${id}/unread`, { method: 'PUT' });
  }

  // ============ Archive ============

  async archiveConversation(id) {
    return this.fetch(`/api/conversations/${id}/archive`, { method: 'PATCH' });
  }

  async unarchiveConversation(id) {
    return this.fetch(`/api/conversations/${id}/unarchive`, { method: 'PATCH' });
  }

  async getArchivedConversations({ page = 1, limit = 30, storeIdentifier } = {}) {
    const params = new URLSearchParams({ page, limit });
    if (storeIdentifier) params.set('storeIdentifier', storeIdentifier);
    return this.fetch(`/api/conversations/archived?${params}`);
  }

  // ============ Blacklist ============

  async blacklistCustomer({ email, storeIdentifier, allStores = false, reason, customerName }) {
    return this.fetch('/api/blacklist', {
      method: 'POST',
      body: JSON.stringify({ email, storeIdentifier, allStores, reason, customerName }),
    });
  }

  async getBlacklist({ page = 1, limit = 50, storeIdentifier, email } = {}) {
    const params = new URLSearchParams({ page, limit });
    if (storeIdentifier) params.set('storeIdentifier', storeIdentifier);
    if (email)           params.set('email', email);
    return this.fetch(`/api/blacklist?${params}`);
  }

  async removeBlacklistEntry(blacklistId) {
    return this.fetch(`/api/blacklist/${blacklistId}`, { method: 'DELETE' });
  }

  async checkBlacklist(email, storeIdentifier) {
    const params = new URLSearchParams({ email });
    if (storeIdentifier) params.set('storeIdentifier', storeIdentifier);
    return this.fetch(`/api/blacklist/check?${params}`);
  }

  // ============ Cross-Store History ============

  async getLinkedConversations(email, excludeConversationId = null) {
    const params = excludeConversationId
      ? `?excludeConversationId=${excludeConversationId}`
      : '';
    return this.fetch(
      `/api/conversations/linked/${encodeURIComponent(email)}${params}`
    );
  }

  // ============ Messages ============

  async getMessages(conversationId) {
    return this.fetch(`/api/conversations/${conversationId}/messages`);
  }

  async sendMessage(data) {
    return this.fetch('/api/messages', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteMessage(messageId) {
    return this.fetch(`/api/messages/${messageId}`, { method: 'DELETE' });
  }

  // ============ Stores ============

  async getStores() {
    return this.fetch('/api/stores');
  }

  async getStore(id) {
    return this.fetch(`/api/stores/${id}`);
  }

  // ============ Customer Context ============

  async getCustomerContext(storeId, email) {
    return this.fetch(`/api/customer-context/${storeId}/${encodeURIComponent(email)}`);
  }

  async getCustomerById(id, storeId) {
    return this.fetch(`/api/customers/${id}/context?storeId=${storeId}`);
  }

  // ============ Stats ============

  async getDashboardStats(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return this.fetch(`/api/stats/dashboard${params ? '?' + params : ''}`);
  }

  async getWebSocketStats() {
    return this.fetch('/api/stats/websocket');
  }

  // ============ Analytics ============

  async getCommonQuestions(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    return this.fetch(`/api/analytics/common-questions${queryParams ? '?' + queryParams : ''}`);
  }

  async clearAnalyticsCache() {
    return this.fetch('/api/analytics/clear-cache', { method: 'POST' });
  }

  // ============ Employees ============

  async getEmployees() {
    return this.fetch('/api/employees');
  }

  async getEmployee(email) {
    return this.fetch(`/api/employees/${encodeURIComponent(email)}`);
  }

  async createEmployee(data) {
    return this.fetch('/api/employees', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateEmployee(id, data) {
    return this.fetch(`/api/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteEmployee(id) {
    return this.fetch(`/api/employees/${id}`, { method: 'DELETE' });
  }

  async updateEmployeeStatus(id, status) {
    return this.fetch(`/api/employees/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  // ============ Message Templates ============

  async getTemplates() {
    return this.fetch('/api/templates');
  }

  async createTemplate(data) {
    return this.fetch('/api/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTemplate(id, data) {
    return this.fetch(`/api/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteTemplate(id) {
    return this.fetch(`/api/templates/${id}`, { method: 'DELETE' });
  }

  // ============ Conversation Notes ============

  async getConversationNotes(conversationId) {
    return this.fetch(`/api/conversations/${conversationId}/notes`);
  }

  async getEmployeeNotes(employeeId) {
    return this.fetch(`/api/employees/${employeeId}/notes`);
  }

  async createNote(data) {
    return this.fetch('/api/conversation-notes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteNote(noteId) {
    return this.fetch(`/api/conversation-notes/${noteId}`, { method: 'DELETE' });
  }

  // ============ Email ============

  async sendEmail({ to, subject, body, conversationId, customerName }) {
    return this.fetch('/api/email/send', {
      method: 'POST',
      body: JSON.stringify({ to, subject, body, conversationId, customerName }),
    });
  }

  // ============ Health Check ============

  async healthCheck() {
    return this.fetch('/health');
  }
}

export default new ApiService();