/**
 * NotificationPermissionHelper Component
 * Shows visual instructions for enabling notifications when blocked
 */

import React, { useState, useEffect } from 'react';
import './NotificationPermissionHelper.css';

function NotificationPermissionHelper({ show, onClose }) {
  const [browserType, setBrowserType] = useState('chrome');

  useEffect(() => {
    // Detect browser type
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.indexOf('firefox') > -1) {
      setBrowserType('firefox');
    } else if (userAgent.indexOf('safari') > -1 && userAgent.indexOf('chrome') === -1) {
      setBrowserType('safari');
    } else if (userAgent.indexOf('edge') > -1 || userAgent.indexOf('edg') > -1) {
      setBrowserType('edge');
    } else {
      setBrowserType('chrome');
    }
  }, []);

  if (!show) return null;

  const instructions = {
    chrome: {
      browser: 'Chrome / Edge / Brave',
      icon: '🟦',
      steps: [
        'Click the lock icon 🔒 or info icon ℹ️ in the address bar (top left)',
        'Look for "Notifications" in the dropdown menu',
        'Change from "Block" to "Allow"',
        'Reload this page',
        'Click "Enable" in the notification settings again'
      ]
    },
    edge: {
      browser: 'Microsoft Edge',
      icon: '🟦',
      steps: [
        'Click the lock icon 🔒 in the address bar',
        'Click "Permissions for this site"',
        'Find "Notifications" and change to "Allow"',
        'Reload this page',
        'Click "Enable" in the notification settings again'
      ]
    },
    firefox: {
      browser: 'Firefox',
      icon: '🟧',
      steps: [
        'Click the lock icon 🔒 in the address bar',
        'Click the arrow (>) next to "Permissions"',
        'Find "Receive Notifications"',
        'Click the X to remove the "Blocked" status',
        'Reload this page and click "Enable" again'
      ]
    },
    safari: {
      browser: 'Safari',
      icon: '🟦',
      steps: [
        'Open Safari → Preferences (or Settings)',
        'Click the "Websites" tab',
        'Click "Notifications" in the left sidebar',
        'Find this website and change to "Allow"',
        'Reload this page'
      ]
    }
  };

  const currentInstructions = instructions[browserType] || instructions.chrome;

  return (
    <div className="notification-helper-overlay">
      <div className="notification-helper-modal">
        <div className="notification-helper-header">
          <h2>
            {currentInstructions.icon} How to Enable Notifications
          </h2>
          <button className="helper-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="notification-helper-body">
          <div className="helper-alert">
            <span className="alert-icon">⚠️</span>
            <div>
              <strong>Notifications are currently blocked</strong>
              <p>Follow these steps to enable them in {currentInstructions.browser}:</p>
            </div>
          </div>

          <ol className="helper-steps">
            {currentInstructions.steps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>

          <div className="helper-visual">
            <div className="visual-hint">
              <span className="hint-icon">💡</span>
              <strong>Quick Tip:</strong> Look for the lock icon 🔒 or info icon ℹ️ 
              in your browser's address bar (where you see the URL)
            </div>
          </div>

          <div className="helper-alternative">
            <h3>Alternative: Check Browser Settings</h3>
            <div className="settings-steps">
              {browserType === 'chrome' && (
                <>
                  <p>1. Click menu (⋮) → Settings</p>
                  <p>2. Privacy and security → Site Settings</p>
                  <p>3. Notifications → Find this site → Allow</p>
                </>
              )}
              {browserType === 'firefox' && (
                <>
                  <p>1. Click menu (☰) → Settings</p>
                  <p>2. Privacy & Security → Permissions</p>
                  <p>3. Notifications → Settings → Allow this site</p>
                </>
              )}
              {browserType === 'safari' && (
                <>
                  <p>1. Safari → Preferences</p>
                  <p>2. Websites tab → Notifications</p>
                  <p>3. Find this site → Allow</p>
                </>
              )}
            </div>
          </div>

          <div className="helper-footer">
            <button className="helper-test-btn" onClick={() => {
              window.location.reload();
            }}>
              🔄 I've enabled it - Reload Page
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NotificationPermissionHelper;