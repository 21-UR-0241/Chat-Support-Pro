import React, { useState, useEffect } from 'react';
import api from '../services/api';
import '../styles/Login.css';

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Check for error from sessionStorage on mount
  useEffect(() => {
    const authError = sessionStorage.getItem('auth_error');
    if (authError) {
      setError(authError);
      sessionStorage.removeItem('auth_error');
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validate inputs
      if (!email || !password) {
        throw new Error('Please enter both email and password');
      }

      if (!email.includes('@')) {
        throw new Error('Please enter a valid email address');
      }

      console.log('🔐 Attempting login for:', email);

      // Call login API using api service
      const data = await api.login(email, password);
      
      console.log('✅ Login successful:', data);
      
      // Store employee data
      localStorage.setItem('employee', JSON.stringify(data.employee));
      localStorage.setItem('token', data.token);

      console.log('💾 Stored in localStorage');

      // Call parent callback
      onLogin(data.employee);
    } catch (err) {
      console.error('❌ Login error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* Background Elements */}
      <div className="login-background">
        <div className="gradient-orb orb-1"></div>
        <div className="gradient-orb orb-2"></div>
        <div className="gradient-orb orb-3"></div>
      </div>

      {/* Login Card */}
      <div className="login-card">
        {/* Header */}
        <div className="login-header">
          <div className="login-logo">
            <div className="logo-icon">💬</div>
          </div>
          <h1 className="login-title">Welcome Back</h1>
          <p className="login-subtitle">Sign in to your admin dashboard</p>
        </div>

        {/* Form */}
        <form className="login-form" onSubmit={handleSubmit}>
          {/* Error Message */}
          {error && (
            <div className="login-error">
              <span className="error-icon">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Email Input */}
          <div className="form-group">
            <label htmlFor="email" className="form-label">
              Email Address
            </label>
            <div className="input-wrapper">
              <span className="input-icon">📧</span>
              <input
                id="email"
                type="email"
                className="form-input"
                placeholder="agent@yourdomain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                autoComplete="email"
                autoFocus
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Password
            </label>
            <div className="input-wrapper">
              <span className="input-icon">🔒</span>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          {/* Remember Me & Forgot Password */}
          <div className="form-options">
            <label className="checkbox-label">
              <input type="checkbox" className="form-checkbox" />
              <span>Remember me</span>
            </label>
            <a href="#forgot" className="forgot-link">
              Forgot password?
            </a>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="login-footer">
          <p className="footer-text">
            Don't have an account?{' '}
            <a href="#signup" className="footer-link">
              Contact your administrator
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;