'use strict';

// Text for an HTML body or a double-quoted attribute of an email: & < > " escaped (not '), null and undefined become ''.
// One copy for the alert and digest renderers (newsBreakingAlert, newsEmailSender). Pure, no deps.

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { escapeHtml };
