import React, { useState, useEffect } from 'react';
import api from '../services/api';
import '../styles/Analytics.css';

function AnalyticsDashboard({ onBack }) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeframe, setTimeframe] = useState('month');
  const [limit, setLimit] = useState(20);

  useEffect(() => {
    fetchAnalytics();
  }, [timeframe, limit]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.getCommonQuestions({ timeframe, limit });
      setAnalytics(response);
    } catch (err) {
      console.error('📊 Error:', err);
      setError(err.message || 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Force refresh (clears cache)
  const forceRefresh = async () => {
    try {
      await api.clearAnalyticsCache();
      await fetchAnalytics();
    } catch (err) {
      console.error('Failed to clear cache:', err);
      await fetchAnalytics();
    }
  };

  // ✅ Helper to pick the best question example
  const getBestQuestion = (examples) => {
    if (!examples || examples.length === 0) return '';
    
    const goodQuestions = examples.filter(q => 
      q.length > 10 && 
      q.length < 150 && 
      (q.endsWith('?') || q.includes('?'))
    );
    
    if (goodQuestions.length > 0) {
      const capitalized = goodQuestions.find(q => q[0] === q[0].toUpperCase());
      return capitalized || goodQuestions[0];
    }
    
    return examples.sort((a, b) => a.length - b.length)[0];
  };


const exportToDocument = () => {
  if (!analytics || !analytics.topQuestions) {
    alert('No data to export');
    return;
  }

  const timeframeLabels = {
    week: 'Last 7 Days',
    month: 'Last 30 Days',
    '3months': 'Last 90 Days',
    all: 'All Time'
  };

  const topicLabels = {
    order_status: 'Order Status / Tracking',
    refund_return: 'Refunds / Returns',
    product_issue: 'Product Issues',
    payment: 'Payment / Billing',
    discount_promo: 'Discounts / Promos',
    product_inquiry: 'Product Questions',
    pickup: 'Pickup / Collection',
    shipping: 'Shipping',
    account: 'Account Issues',
  };

  const issueLabels = {
    damaged: 'Damaged Items',
    wrong_item: 'Wrong Item Received',
    missing: 'Missing/Not Received',
    late: 'Late Delivery',
    quality: 'Quality Issues',
  };

  const sentimentLabels = {
    very_negative: 'Very Negative',
    negative: 'Negative',
    neutral: 'Neutral',
    positive: 'Positive',
    very_positive: 'Very Positive',
  };

  // Generate simple HTML for Word
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Customer Questions Analytics</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 20px;
      line-height: 1.6;
      color: #333;
    }
    h1 {
      font-size: 20px;
      margin-bottom: 10px;
      border-bottom: 2px solid #333;
      padding-bottom: 8px;
    }
    .meta {
      margin: 15px 0 30px 0;
      font-size: 14px;
      color: #666;
    }
    .question-item {
      margin: 20px 0;
      padding: 15px;
      border-left: 3px solid #4caf50;
      background: #fafafa;
    }
    .question-header {
      font-weight: bold;
      margin-bottom: 8px;
      font-size: 14px;
    }
    .question-text {
      font-size: 15px;
      margin: 10px 0;
    }
    .question-meta {
      font-size: 13px;
      color: #666;
      margin-top: 8px;
    }
    .examples {
      margin-top: 12px;
      padding: 10px;
      background: white;
      border-radius: 3px;
    }
    .examples-title {
      font-weight: bold;
      font-size: 12px;
      color: #666;
      margin-bottom: 5px;
    }
    ul {
      margin: 5px 0;
      padding-left: 20px;
    }
    li {
      margin: 4px 0;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <h1>Customer Questions Analytics Report</h1>
  
  <div class="meta">
    <strong>Period:</strong> ${timeframeLabels[timeframe]}<br>
    <strong>Generated:</strong> ${new Date().toLocaleString()}<br>
    <strong>Messages Analyzed:</strong> ${analytics.summary.totalMessagesAnalyzed.toLocaleString()}<br>
    <strong>Questions Found:</strong> ${analytics.summary.questionsFound.toLocaleString()}<br>
    <strong>Question Rate:</strong> ${analytics.summary.totalMessagesAnalyzed > 0 
      ? ((analytics.summary.questionsFound / analytics.summary.totalMessagesAnalyzed) * 100).toFixed(1)
      : 0}%
  </div>

  ${analytics.topQuestions
    .filter(item => item.question && item.question.trim() !== '' && item.question !== 'general question')
    .map((item, index) => {
      const displayQuestion = getBestQuestion(item.examples) || item.question;
      const sentimentLabel = sentimentLabels[item.sentiment] || item.sentiment;
      
      return `
        <div class="question-item">
          <div class="question-header">
            #${index + 1} - ${item.count} ${item.count === 1 ? 'time' : 'times'} - ${sentimentLabel}
          </div>
          
          <div class="question-text">${displayQuestion}</div>
          
          <div class="question-meta">
            Topic: ${topicLabels[item.primaryTopic] || item.primaryTopic}${item.primaryIssue ? ` | Issue: ${issueLabels[item.primaryIssue] || item.primaryIssue}` : ''}
          </div>
          
          ${item.count > 1 && item.examples && item.examples.length > 1 ? `
            <div class="examples">
              <div class="examples-title">Similar questions (${item.count - 1}):</div>
              <ul>
                ${item.examples
                  .filter(ex => ex !== displayQuestion)
                  .slice(0, 10)
                  .map(ex => `<li>${ex}</li>`)
                  .join('')}
                ${item.examples.length > 11 ? `<li><em>...and ${item.count - 11} more</em></li>` : ''}
              </ul>
            </div>
          ` : ''}
        </div>
      `;
    }).join('')}

</body>
</html>
  `;

  // Create blob and download as .doc
  const blob = new Blob(['\ufeff', htmlContent], {
    type: 'application/msword'
  });
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `customer-questions-analytics-${timeframe}-${new Date().toISOString().split('T')[0]}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};


  
  if (loading) {
    return (
      <div className="analytics-container">
        {onBack && (
          <button className="analytics-back-btn" onClick={onBack}>
            ← Back to Dashboard
          </button>
        )}
        <div className="analytics-loading">
          <div className="spinner"></div>
          <p>Analyzing customer questions...</p>
          {timeframe === 'all' && (
            <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
              Analyzing all messages may take a few moments...
            </p>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analytics-container">
        {onBack && (
          <button className="analytics-back-btn" onClick={onBack}>
            ← Back to Dashboard
          </button>
        )}
        <div className="analytics-error">
          <p>❌ {error}</p>
          <button onClick={fetchAnalytics} className="retry-btn">Retry</button>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="analytics-container">
        {onBack && (
          <button className="analytics-back-btn" onClick={onBack}>
            ← Back to Dashboard
          </button>
        )}
        <div className="analytics-error">
          <p>No analytics data available</p>
        </div>
      </div>
    );
  }

  if (analytics.summary.totalMessagesAnalyzed === 0) {
    return (
      <div className="analytics-container">
        {onBack && (
          <button className="analytics-back-btn" onClick={onBack}>
            ← Back to Dashboard
          </button>
        )}
        <div className="analytics-dashboard">
          <div className="analytics-header">
            <h1>📊 Customer Questions Analytics</h1>
          </div>
          <div className="analytics-empty-state">
            <div className="empty-state-icon">📭</div>
            <h2>No Customer Messages Yet</h2>
            <p>Analytics will appear once customers start sending messages.</p>
            <p className="empty-state-hint">
              💡 Tip: Customer messages with questions will be automatically analyzed and displayed here.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const topicLabels = {
    order_status: 'Order Status / Tracking',
    refund_return: 'Refunds / Returns',
    product_issue: 'Product Issues',
    payment: 'Payment / Billing',
    discount_promo: 'Discounts / Promos',
    product_inquiry: 'Product Questions',
    pickup: 'Pickup / Collection',
    shipping: 'Shipping',
    account: 'Account Issues',
  };

  const issueLabels = {
    damaged: 'Damaged Items',
    wrong_item: 'Wrong Item Received',
    missing: 'Missing/Not Received',
    late: 'Late Delivery',
    quality: 'Quality Issues',
  };

  const sentimentEmoji = {
    very_negative: '😡',
    negative: '😟',
    neutral: '😐',
    positive: '😊',
    very_positive: '🎉',
  };

  return (
    <div className="analytics-container">
      {onBack && (
        <button className="analytics-back-btn" onClick={onBack}>
          ← Back to Dashboard
        </button>
      )}
      
      <div className="analytics-dashboard">
        <div className="analytics-header">
          <div>
            <h1>📊 Customer Questions Analytics</h1>
            
            <div style={{ 
              fontSize: '12px', 
              color: '#666', 
              marginTop: '8px',
              display: 'flex',
              gap: '15px',
              alignItems: 'center'
            }}>
              {analytics.cached && (
                <span style={{ 
                  background: '#e3f2fd', 
                  padding: '4px 8px', 
                  borderRadius: '4px',
                  color: '#1976d2'
                }}>
                  ⚡ Cached ({Math.floor(analytics.cacheAge / 60)}m {analytics.cacheAge % 60}s old)
                </span>
              )}
              
              {analytics.summary.processingTimeMs && (
                <span>
                  Processed in {analytics.summary.processingTimeMs}ms
                </span>
              )}
              
              <span>
                {analytics.summary.totalMessagesAnalyzed.toLocaleString()} messages analyzed
              </span>
            </div>
          </div>

          <div className="analytics-controls">
            <select 
              value={timeframe} 
              onChange={(e) => setTimeframe(e.target.value)}
              className="analytics-select"
            >
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="3months">Last 90 Days</option>
              <option value="all">All Time</option>
            </select>

            <select 
              value={limit} 
              onChange={(e) => setLimit(e.target.value)}
              className="analytics-select"
            >
              <option value="10">Top 10</option>
              <option value="20">Top 20</option>
              <option value="50">Top 50</option>
            </select>

            {/* ✅ Export Button */}
            <button 
              onClick={exportToDocument} 
              className="analytics-export-btn"
              title="Download as Word document"
            >
              📥 Export to Word
            </button>

            {analytics.cached ? (
              <button 
                onClick={forceRefresh} 
                className="analytics-refresh-btn"
                title="Clear cache and fetch fresh data"
              >
                🔄 Force Refresh
              </button>
            ) : (
              <button onClick={fetchAnalytics} className="analytics-refresh-btn">
                ↻ Refresh
              </button>
            )}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="analytics-summary">
          <div className="analytics-stat-card">
            <div className="stat-value">{analytics.summary.totalMessagesAnalyzed.toLocaleString()}</div>
            <div className="stat-label">Messages Analyzed</div>
          </div>
          <div className="analytics-stat-card">
            <div className="stat-value">{analytics.summary.questionsFound.toLocaleString()}</div>
            <div className="stat-label">Questions Found</div>
          </div>
          <div className="analytics-stat-card">
            <div className="stat-value">
              {analytics.summary.totalMessagesAnalyzed > 0 
                ? ((analytics.summary.questionsFound / analytics.summary.totalMessagesAnalyzed) * 100).toFixed(1)
                : 0}%
            </div>
            <div className="stat-label">Question Rate</div>
          </div>
        </div>

        {/* Top Questions */}
        {analytics.topQuestions && analytics.topQuestions.length > 0 ? (
          <div className="analytics-section">
            <h2>Most Common Questions</h2>
            <div className="questions-list">
              {analytics.topQuestions
                .filter(item => item.question && item.question.trim() !== '' && item.question !== 'general question')
                .map((item, index) => {
                  const displayQuestion = getBestQuestion(item.examples) || item.question;

                  return (
                    <div key={index} className="question-card">
                      <div className="question-header">
                        <span className="question-rank">#{index + 1}</span>
                        <span className="question-count">{item.count} {item.count === 1 ? 'time' : 'times'}</span>
                        <span className="question-sentiment">{sentimentEmoji[item.sentiment]}</span>
                      </div>
                      
                      <div className="question-text">
                        {displayQuestion}
                      </div>
                      
                      <div className="question-meta">
                        <span className="question-topic">
                          {topicLabels[item.primaryTopic] || item.primaryTopic}
                        </span>
                        {item.primaryIssue && (
                          <span className="question-issue">
                            {issueLabels[item.primaryIssue] || item.primaryIssue}
                          </span>
                        )}
                      </div>
                      
                      {item.count > 1 && item.examples && item.examples.length > 1 && (
                        <details className="question-examples">
                          <summary>
                            +{item.count - 1} similar {item.count - 1 === 1 ? 'question' : 'questions'}
                          </summary>
                          <ul>
                            {item.examples
                              .filter(ex => ex !== displayQuestion)
                              .slice(0, 10)
                              .map((example, i) => (
                                <li key={i}>{example}</li>
                              ))}
                            {item.examples.length > 11 && (
                              <li style={{ fontStyle: 'italic', color: '#666' }}>
                                ...and {item.count - 11} more
                              </li>
                            )}
                          </ul>
                        </details>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        ) : (
          <div className="analytics-section">
            <h2>Most Common Questions</h2>
            <p className="no-data">No questions found in the selected timeframe</p>
          </div>
        )}

        {/* Top Topics */}
        {analytics.topTopics && analytics.topTopics.length > 0 && (
          <div className="analytics-section">
            <h2>Top Topics</h2>
            <div className="topics-grid">
              {analytics.topTopics.map((item, index) => (
                <div key={index} className="topic-card">
                  <div className="topic-name">{topicLabels[item.topic] || item.topic}</div>
                  <div className="topic-count">{item.count} questions</div>
                  <div className="topic-bar">
                    <div 
                      className="topic-bar-fill" 
                      style={{ 
                        width: `${(item.count / analytics.topTopics[0].count) * 100}%` 
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Issues */}
        {analytics.topIssues && analytics.topIssues.length > 0 && (
          <div className="analytics-section">
            <h2>Top Issues</h2>
            <div className="issues-grid">
              {analytics.topIssues.map((item, index) => (
                <div key={index} className="issue-card">
                  <div className="issue-name">{issueLabels[item.issue] || item.issue}</div>
                  <div className="issue-count">{item.count} reports</div>
                  <div className="issue-bar">
                    <div 
                      className="issue-bar-fill" 
                      style={{ 
                        width: `${(item.count / analytics.topIssues[0].count) * 100}%` 
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sentiment Breakdown */}
        {analytics.sentimentBreakdown && (
          <div className="analytics-section">
            <h2>Sentiment Breakdown</h2>
            <div className="sentiment-grid">
              {Object.entries(analytics.sentimentBreakdown).map(([sentiment, count]) => (
                <div key={sentiment} className="sentiment-card">
                  <div className="sentiment-emoji">{sentimentEmoji[sentiment]}</div>
                  <div className="sentiment-label">
                    {sentiment.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </div>
                  <div className="sentiment-count">{count}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AnalyticsDashboard;