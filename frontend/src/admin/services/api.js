
// /**
//  * API Service
//  * Handles all API calls to the backend with authentication
//  */

// // Use Vite proxy in development, full URL in production
// const API_URL = import.meta.env.PROD 
//   ? import.meta.env.VITE_API_URL || 'https://chat-support-pro.onrender.com'
//   : '';

// class ApiService {
//   constructor() {
//     this.baseUrl = API_URL;
//   }

//   /**
//    * Get auth token from localStorage
//    */
//   getToken() {
//     return localStorage.getItem('token');
//   }

//   /**
//    * Clear auth data and redirect to login
//    */
// handleUnauthorized() {
//   console.log('🚨 UNAUTHORIZED - Clearing session');
//   localStorage.removeItem('token');
//   localStorage.removeItem('employee');
  
//   // Store error message for display after reload
//   sessionStorage.setItem('auth_error', 'Session expired. Please login again.');
  
//   // Reload to reset app state
//   window.location.reload();
// }

//   /**
//    * Generic fetch wrapper with error handling and auth
//    */
//   async fetch(endpoint, options = {}) {
//     const url = `${this.baseUrl}${endpoint}`;
    
//     // Get token from localStorage
//     const token = this.getToken();
    
//     const defaultOptions = {
//       headers: {
//         'Content-Type': 'application/json',
//         ...(token && { 'Authorization': `Bearer ${token}` }), // Add auth header if token exists
//         ...options.headers,
//       },
//     };

//     try {
//       const response = await fetch(url, { ...defaultOptions, ...options });
      
//       // Handle 401 Unauthorized - token expired or invalid
//       if (response.status === 401) {
//         this.handleUnauthorized();
//         throw new Error('Session expired. Please login again.');
//       }

//       // Handle 403 Forbidden
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

//   // ============ Authentication ============

//   async login(email, password) {
//     return this.fetch('/api/employees/login', {
//       method: 'POST',
//       body: JSON.stringify({ email, password }),
//     });
//   }

//   async logout() {
//     try {
//       await this.fetch('/api/employees/logout', {
//         method: 'POST',
//       });
//     } catch (error) {
//       console.error('Logout error:', error);
//     } finally {
//       // Always clear local data even if API call fails
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
// return this.fetch(`/api/conversations/${id}/close`, {
//   method: 'PUT',
// });
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

//   // ============ Employees (CRUD) ============

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
//     return this.fetch(`/api/employees/${id}`, {
//       method: 'DELETE',
//     });
//   }

//   async updateEmployeeStatus(id, status) {
//     return this.fetch(`/api/employees/${id}/status`, {
//       method: 'PUT',
//       body: JSON.stringify({ status }),
//     });
//   }
  
//   async markConversationRead(id) {
//     return this.fetch(`/api/conversations/${id}/read`, { method: 'PUT' });
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
//     return this.fetch(`/api/templates/${id}`, {
//       method: 'DELETE',
//     });
//   }

//   // ============ Health Check ============

//   async healthCheck() {
//     return this.fetch('/health');
//   }
// }

// export default new ApiService();




/**
 * API Service
 * Handles all API calls to the backend with authentication
 */

// Use Vite proxy in development, full URL in production
const API_URL = import.meta.env.PROD 
  ? import.meta.env.VITE_API_URL || 'https://chat-support-pro.onrender.com'
  : '';

class ApiService {
  constructor() {
    this.baseUrl = API_URL;
  }

  /**
   * Get auth token from localStorage
   */
  getToken() {
    return localStorage.getItem('token');
  }

  /**
   * Clear auth data and redirect to login
   */
  handleUnauthorized() {
    console.log('🚨 UNAUTHORIZED - Clearing session');
    localStorage.removeItem('token');
    localStorage.removeItem('employee');
    
    // Store error message for display after reload
    sessionStorage.setItem('auth_error', 'Session expired. Please login again.');
    
    // Reload to reset app state
    window.location.reload();
  }

  /**
   * Generic fetch wrapper with error handling and auth
   */
  async fetch(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    // Get token from localStorage
    const token = this.getToken();
    
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }), // Add auth header if token exists
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, { ...defaultOptions, ...options });
      
      // Handle 401 Unauthorized - token expired or invalid
      if (response.status === 401) {
        this.handleUnauthorized();
        throw new Error('Session expired. Please login again.');
      }

      // Handle 403 Forbidden
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

  /**
   * Upload file with XMLHttpRequest (for progress tracking)
   */
  async uploadFile(formData, onUploadProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const url = `${this.baseUrl}/api/files/upload`;
      const token = this.getToken();

      // Track upload progress
      if (onUploadProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            onUploadProgress({
              loaded: e.loaded,
              total: e.total,
            });
          }
        });
      }

      // Handle completion
      xhr.addEventListener('load', () => {
        if (xhr.status === 200 || xhr.status === 201) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
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

      // Handle errors
      xhr.addEventListener('error', () => {
        reject(new Error('Network error during file upload'));
      });

      xhr.addEventListener('abort', () => {
        reject(new Error('File upload was cancelled'));
      });

      // Open connection and set headers
      xhr.open('POST', url);
      
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      // Send the file
      xhr.send(formData);
    });
  }

  /**
   * Delete a file from storage
   */
  async deleteFile(fileName) {
    return this.fetch(`/api/files/${fileName}`, {
      method: 'DELETE',
    });
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
      await this.fetch('/api/employees/logout', {
        method: 'POST',
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Always clear local data even if API call fails
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
    return this.fetch(`/api/conversations/${id}/close`, {
      method: 'PUT',
    });
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

  // ============ Employees (CRUD) ============

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
    return this.fetch(`/api/employees/${id}`, {
      method: 'DELETE',
    });
  }

  async updateEmployeeStatus(id, status) {
    return this.fetch(`/api/employees/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }
  
  async markConversationRead(id) {
    return this.fetch(`/api/conversations/${id}/read`, { method: 'PUT' });
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
    return this.fetch(`/api/templates/${id}`, {
      method: 'DELETE',
    });
  }

  // ============ Health Check ============

  async healthCheck() {
    return this.fetch('/health');
  }
}

export default new ApiService();