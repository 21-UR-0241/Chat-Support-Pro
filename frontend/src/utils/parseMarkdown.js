/**
 * Lightweight markdown parser for chat message content.
 * Converts markdown syntax to sanitized HTML strings.
 * Supports: **bold**, *italic*, `code`, ~~strikethrough~~, line breaks
 */
export const parseMarkdown = (text) => {
  if (!text || typeof text !== 'string') return '';

  return text
    // Escape raw HTML to prevent XSS
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

    // Bold: **text** or __text__
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')

    // Italic: *text* or _text_ (single, not double)
    .replace(/\*(?!\*)(.+?)(?<!\*)\*/g, '<em>$1</em>')
    .replace(/_(?!_)(.+?)(?<!_)_/g, '<em>$1</em>')

    // Strikethrough: ~~text~~
    .replace(/~~(.+?)~~/g, '<s>$1</s>')

    // Inline code: `code`
    .replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,0.08);padding:1px 5px;border-radius:4px;font-size:0.9em;font-family:monospace;">$1</code>')

    // Line breaks
    .replace(/\n/g, '<br/>');
};