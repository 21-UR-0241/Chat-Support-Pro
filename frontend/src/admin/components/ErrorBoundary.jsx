import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('❌ Error caught by boundary:', error);
    console.error('Component stack:', errorInfo.componentStack);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          background: 'var(--bg-secondary)',
          borderRadius: '8px',
          margin: '20px'
        }}>
          <h2 style={{ color: '#e53e3e', marginBottom: '10px' }}>
            ⚠️ Something went wrong
          </h2>
          <p style={{ color: '#718096', marginBottom: '20px' }}>
            {this.state.error?.toString()}
          </p>
          <details style={{ 
            textAlign: 'left', 
            background: '#f7fafc', 
            padding: '10px',
            borderRadius: '4px',
            marginBottom: '20px'
          }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
              Error Details
            </summary>
            <pre style={{ 
              fontSize: '12px', 
              overflow: 'auto',
              marginTop: '10px'
            }}>
              {this.state.errorInfo?.componentStack}
            </pre>
          </details>
          <button 
            onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
            style={{
              background: '#667eea',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;