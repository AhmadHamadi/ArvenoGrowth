import brand from '../src/brand-config.json' with { type: 'json' };

export async function sendTransactionalEmail({ to, subject, text, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: 'RESEND_API_KEY is not configured.' };
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || `${brand.name} <${brand.contactEmail}>`,
      to: Array.isArray(to) ? to : [to], subject, text, html
    })
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Transactional email could not be sent (${response.status}). ${detail.slice(0, 180)}`);
  }
  return { sent: true };
}
