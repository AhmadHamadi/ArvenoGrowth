/**
 * The one email template this site uses.
 *
 * Deliberately plain: a rule, a heading, labelled rows, and a body. No nested
 * tables, no dark banner blocks, no rounded cards. Those render unpredictably
 * across mail clients and make a lead notification look like a newsletter.
 * Every email sent from here uses this shell so they all look like one system.
 */

export const BRAND = '#F37021';
export const INK   = '#15140F';
export const MUTED = '#6B6659';
export const LINE  = '#E2DED4';

const DASH = '<span style="color:#9A958A;">-</span>';

export const escapeHtml = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

const filled = (v) => v !== undefined && v !== null && String(v).trim() !== '';

/**
 * rows      [label, value, optionalHref][]
 * message   optional free-text block; pass undefined to omit it entirely
 * extraHtml optional pre-rendered block appended after the message
 */
export function shell({ heading, rows = [], message, messageLabel, extraHtml, footNote }) {
  const rowHtml = rows.map(([label, value, href]) => {
    const shown = filled(value) ? escapeHtml(value) : DASH;
    const cell = filled(value) && href
      ? `<a href="${escapeHtml(href)}" style="color:${INK};">${shown}</a>`
      : shown;
    return `<tr>`
      + `<td style="padding:7px 0;color:${MUTED};font-size:14px;width:160px;vertical-align:top;">${escapeHtml(label)}</td>`
      + `<td style="padding:7px 0;color:${INK};font-size:14px;font-weight:600;">${cell}</td>`
      + `</tr>`;
  }).join('');

  const messageBlock = message === undefined ? '' :
    `<div style="margin-top:22px;padding-top:18px;border-top:1px solid ${LINE};">`
    + `<div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${MUTED};">`
    + escapeHtml(messageLabel || 'Message')
    + `</div>`
    + `<div style="margin-top:8px;font-size:14px;line-height:1.6;color:${INK};white-space:pre-wrap;">`
    + (filled(message) ? escapeHtml(message) : DASH)
    + `</div></div>`;

  return `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;padding:8px;">
  <div style="border-top:3px solid ${BRAND};padding-top:18px;">
    <div style="font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${MUTED};">Trade Leads Marketing</div>
    <h1 style="margin:8px 0 22px;font-size:22px;line-height:1.25;color:${INK};font-weight:800;">${escapeHtml(heading)}</h1>
    ${rowHtml ? `<table style="width:100%;border-collapse:collapse;">${rowHtml}</table>` : ''}
    ${messageBlock}
    ${extraHtml || ''}
    <div style="margin-top:26px;padding-top:14px;border-top:1px solid ${LINE};font-size:12px;color:${MUTED};">
      ${escapeHtml(footNote || `Sent from tradeleadsmarketing.com on ${new Date().toUTCString()}`)}
    </div>
  </div>
</div>`;
}

/** Plain-text twin of the shell: same content, same order. */
export function shellText({ heading, rows = [], message, messageLabel, extraText, footNote }) {
  const pad = (s) => `${s}:`.padEnd(18, ' ');
  return [
    heading.toUpperCase(),
    '',
    ...rows.map(([label, value]) => `${pad(label)}${filled(value) ? value : '-'}`),
    ...(message === undefined ? [] : ['', `${(messageLabel || 'Message').toUpperCase()}:`, filled(message) ? message : '-']),
    ...(extraText ? ['', extraText] : []),
    '',
    footNote || `Sent from tradeleadsmarketing.com on ${new Date().toUTCString()}`
  ].join('\n');
}
