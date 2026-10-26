/**
 * Columns for the email history popup (MessageHistoryDialog), shared by the
 * lead and application pages. The signature is embedded through
 * messages.signature_id so history can show it under the body, as sent.
 * Lives outside the dialog's 'use client' module so server pages can read
 * the value rather than a client reference.
 */
export const MESSAGE_HISTORY_COLUMNS =
  'id, subject, body, body_is_html, status, template_key, sent_by, created_at, error_detail, email_signatures(body_html)';
