/*!
 * chat-render.js — pure, DOM-free formatting helpers shared by all views.
 * Keeps message rendering (and its XSS-safe escape→markdown order) identical
 * across every design skin.
 */
(function (global) {
  'use strict';

  function escapeHtml(text) {
    var d = document.createElement('div');
    d.textContent = text == null ? '' : text;
    return d.innerHTML;
  }

  // escape FIRST, then apply a small safe markdown subset. Never reorder.
  function parseMarkdown(text) {
    if (!text || typeof text !== 'string') return '';
    var esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return esc
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.+?)__/g, '<strong>$1</strong>')
      .replace(/\*(?!\*)(.+?)(?<!\*)\*/g, '<em>$1</em>')
      .replace(/_(?!_)(.+?)(?<!_)_/g, '<em>$1</em>')
      .replace(/~~(.+?)~~/g, '<s>$1</s>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\b(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/\n/g, '<br>');
  }

  function formatMessageTime(ts) {
    return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
  function formatMessageDate(ts) {
    var d = new Date(ts), t = new Date(), y = new Date(t); y.setDate(y.getDate() - 1);
    if (d.toDateString() === t.toDateString()) return 'Today';
    if (d.toDateString() === y.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== t.getFullYear() ? 'numeric' : undefined });
  }
  function formatFileSize(b) {
    if (b === 0 || b == null) return '';
    var k = 1024, s = ['Bytes', 'KB', 'MB', 'GB'], i = Math.floor(Math.log(b) / Math.log(k));
    return Math.round(b / Math.pow(k, i) * 100) / 100 + ' ' + s[i];
  }
  function getInitials(name) {
    if (!name) return 'CS';
    var p = name.trim().split(' ');
    if (p.length === 1) return p[0].substring(0, 2).toUpperCase();
    return (p[0][0] + p[p.length - 1][0]).toUpperCase();
  }
  function fileAttachmentHtml(fd) {
    if (!fd || !fd.url) return '';
    if (fd.type && fd.type.indexOf('image/') === 0)
      return '<div class="att att-img"><img src="' + escapeHtml(fd.url) + '" alt="' + escapeHtml(fd.name || 'Image') + '"></div>';
    return '<div class="att att-doc"><span class="att-icon">\ud83d\udcce</span><span class="att-meta"><span class="att-name">' +
      escapeHtml(fd.name || 'File') + '</span>' + (fd.size ? '<span class="att-size">' + formatFileSize(fd.size) + '</span>' : '') + '</span></div>';
  }

  global.ChatRender = {
    escapeHtml: escapeHtml,
    parseMarkdown: parseMarkdown,
    formatMessageTime: formatMessageTime,
    formatMessageDate: formatMessageDate,
    formatFileSize: formatFileSize,
    getInitials: getInitials,
    fileAttachmentHtml: fileAttachmentHtml
  };
})(window);