/**
 * @file sanitize.js
 * @description Utilidades de saneamiento HTML para prevenir vulnerabilidades XSS.
 */

export function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[ch]);
}

export function sanitizeAttribute(value) {
  return String(value ?? '').replace(/["'<>&]/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[ch]);
}
