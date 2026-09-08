import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { buildClauses, selectedServices, money, longDate, SIGNERS, AGENCY } from '../src/contract-model.js';

/**
 * Renders the signed agreement as a real PDF, so the email can stay short and
 * the attachment is the document people actually keep and print.
 *
 * Uses the standard Helvetica faces, which every PDF reader already has, so
 * nothing is embedded and the file stays around 20KB plus the signature image.
 */

const PAGE_W = 612;   // US Letter, points
const PAGE_H = 792;
const MARGIN = 54;
const BODY_W = PAGE_W - MARGIN * 2;

const INK   = rgb(0.082, 0.078, 0.059);
const MUTED = rgb(0.42, 0.40, 0.35);
const RULE  = rgb(0.78, 0.76, 0.72);
const BRAND = rgb(0.69, 0.25, 0.0);

/* The standard Helvetica faces are WinAnsi-encoded, and pdf-lib throws on any
   character outside that set. A single emoji in a business name would otherwise
   cost the client their whole PDF, so every string is folded into the encodable
   range on the way in: accents flatten to their base letter, decoration and
   zero-width marks are dropped, and anything still unrepresentable becomes a
   question mark rather than an exception. */
const WINANSI_EXTRA = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160,
  0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
  0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178
]);

const encodable = (ch) => {
  const cp = ch.codePointAt(0);
  return (cp >= 0x20 && cp <= 0x7e) || (cp >= 0xa0 && cp <= 0xff) || WINANSI_EXTRA.has(cp);
};

/** Drop: combining marks, zero-width joiners, variation selectors, skin tones. */
const DECORATION = /[\u0300-\u036f\u200b-\u200f\ufe00-\ufe0f\u2060-\u2064]|[\u{1f3fb}-\u{1f3ff}]/gu;

function pdfSafe(value) {
  const out = [];
  for (const ch of String(value ?? '').normalize('NFC')) {
    if (encodable(ch)) { out.push(ch); continue; }
    const folded = ch.normalize('NFKD').replace(DECORATION, '');
    if (folded && [...folded].every(encodable)) { out.push(folded); continue; }
    // Symbols, emoji, and zero-width marks are decoration on a legal document
    // and simply go. Letters and digits are not, so they leave a visible
    // placeholder rather than vanishing from a name without a trace.
    if (/\p{L}|\p{N}/u.test(ch)) out.push('?');
  }
  return out.join('').replace(/[ \t]{2,}/g, ' ').trim();
}

/** Splits a **bold** string into [{ text, bold }] runs. */
function runs(line) {
  return pdfSafe(line).split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part) =>
    part.startsWith('**') && part.endsWith('**')
      ? { text: part.slice(2, -2), bold: true }
      : { text: part, bold: false }
  );
}

/** Greedy wrap that keeps bold runs intact across line breaks. */
function wrapRuns(parts, width, size, font, fontBold) {
  const lines = [];
  let line = [];
  let w = 0;

  for (const part of parts) {
    const f = part.bold ? fontBold : font;
    for (const word of part.text.split(/(\s+)/)) {
      if (!word) continue;
      const ww = f.widthOfTextAtSize(word, size);
      if (w + ww > width && line.length && word.trim()) {
        lines.push(line);
        line = [];
        w = 0;
        if (!word.trim()) continue;
      }
      if (!line.length && !word.trim()) continue; // no leading space on a new line
      line.push({ text: word, bold: part.bold, w: ww });
      w += ww;
    }
  }
  if (line.length) lines.push(line);
  return lines;
}

export async function buildContractPdf({ d, typedName, signedAtLong, reference, signaturePngBase64 }) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  pdf.setTitle(`Marketing Services Agreement — ${d.clientBusiness || 'Client'}`);
  pdf.setAuthor(AGENCY.name);
  pdf.setSubject(reference);
  pdf.setCreator(AGENCY.name);

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const newPage = () => { page = pdf.addPage([PAGE_W, PAGE_H]); y = PAGE_H - MARGIN; };
  const room = (needed) => { if (y - needed < MARGIN + 40) newPage(); };

  const text = (str, { size = 10, f = font, color = INK, x = MARGIN, gap = 0 } = {}) => {
    room(size + gap);
    page.drawText(pdfSafe(str), { x, y: y - size, size, font: f, color });
    y -= size + gap;
  };

  const rule = (color = RULE, thickness = 0.75, gap = 10) => {
    room(gap + 2);
    page.drawLine({
      start: { x: MARGIN, y: y - 2 }, end: { x: PAGE_W - MARGIN, y: y - 2 },
      thickness, color
    });
    y -= gap;
  };

  /** Draws wrapped, bold-aware body text. */
  const paragraph = (str, { size = 9.5, indent = 0, lead = 3.6, gap = 6 } = {}) => {
    const width = BODY_W - indent;
    const lines = wrapRuns(runs(str), width, size, font, bold);
    for (const line of lines) {
      room(size + lead);
      let x = MARGIN + indent;
      for (const seg of line) {
        page.drawText(seg.text, { x, y: y - size, size, font: seg.bold ? bold : font, color: INK });
        x += seg.w;
      }
      y -= size + lead;
    }
    y -= gap;
  };

  /* ---------- letterhead ---------- */
  page.drawRectangle({ x: MARGIN, y: y - 4, width: BODY_W, height: 3, color: BRAND });
  y -= 18;
  text(AGENCY.name, { size: 15, f: bold, gap: 3 });
  text(`${AGENCY.site}   ${AGENCY.email}   ${AGENCY.phone}`, { size: 8.5, color: MUTED, gap: 14 });

  text('MARKETING SERVICES AGREEMENT', { size: 13, f: bold, gap: 4 });
  text(`Reference ${reference}`, { size: 9, color: MUTED, gap: 12 });
  rule(INK, 1, 16);

  /* ---------- terms at a glance ---------- */
  const monthly = money(d.monthlyFee, d.currency);
  const rows = [
    ['Client', `${d.clientBusiness || '-'}${d.clientContact ? `  (${d.clientContact}${d.clientTitle ? `, ${d.clientTitle}` : ''})` : ''}`],
    ['Address', d.clientAddress || '-'],
    ['Contact', [d.clientEmail, d.clientPhone].filter(Boolean).join('   ') || '-'],
    ['Agreement date', longDate(d.agreementDate) || '-'],
    ['Setup begins', longDate(d.setupStart) || '-'],
    ['Initial setup fee', money(d.setupFee, d.currency) || '-'],
    ['Monthly service fee', monthly ? `${monthly}, from the setup completion date` : '-'],
    ['Term', d.term || '-'],
    ['Services', selectedServices(d).map((s) => s.label).join(', ') || '-']
  ];

  for (const [label, value] of rows) {
    const lines = wrapRuns(runs(value), BODY_W - 130, 9.5, font, bold);
    room(lines.length * 13 + 6);
    page.drawText(label, { x: MARGIN, y: y - 9.5, size: 9.5, font, color: MUTED });
    let ly = y;
    for (const line of lines) {
      let x = MARGIN + 130;
      for (const seg of line) {
        page.drawText(seg.text, { x, y: ly - 9.5, size: 9.5, font: seg.bold ? bold : font, color: INK });
        x += seg.w;
      }
      ly -= 13;
    }
    y = ly - 3;
  }

  y -= 6;
  rule(INK, 1, 18);

  /* ---------- clauses ---------- */
  for (const clause of buildClauses(d)) {
    room(34);
    text(`${clause.n}. ${clause.title}`, { size: 10.5, f: bold, gap: 5 });
    for (const para of clause.paras) {
      if (para.startsWith('- ')) {
        room(14);
        page.drawText('•', { x: MARGIN + 8, y: y - 9.5, size: 9.5, font, color: MUTED });
        paragraph(para.slice(2), { indent: 20, gap: 3 });
      } else {
        paragraph(para);
      }
    }
    y -= 4;
  }

  /* ---------- signatures ---------- */
  const signer = SIGNERS[d.signerIndex] || SIGNERS[0];
  // Reserve the whole block in one go — rule, lead-in, both signature columns,
  // and the closing note. Reserving only the columns let the note fall alone
  // onto a page of its own, which reads like a page is missing.
  room(215);
  rule(INK, 1, 14);
  text('The parties agree to the terms above and have signed on the dates shown.', { size: 9.5, gap: 20 });

  const colW = (BODY_W - 30) / 2;
  const rightX = MARGIN + colW + 30;
  const blockTop = y;

  page.drawText(pdfSafe(`For ${AGENCY.name}`), { x: MARGIN, y: blockTop, size: 8, font: bold, color: MUTED });
  page.drawText(pdfSafe(`For ${d.clientBusiness || 'the Client'}`), { x: rightX, y: blockTop, size: 8, font: bold, color: MUTED });

  // TLM side: the countersignature is attested by name, as it is on the signing page
  page.drawText(pdfSafe(signer.name), { x: MARGIN, y: blockTop - 40, size: 15, font: bold, color: INK });

  // Client side: the drawn signature, sized to fit its column
  if (signaturePngBase64) {
    try {
      const png = await pdf.embedPng(Buffer.from(signaturePngBase64, 'base64'));
      const scale = Math.min(colW / png.width, 46 / png.height, 1);
      page.drawImage(png, {
        x: rightX,
        y: blockTop - 52,
        width: png.width * scale,
        height: png.height * scale
      });
    } catch { /* an unreadable image must not cost us the whole document */ }
  }

  for (const x of [MARGIN, rightX]) {
    page.drawLine({ start: { x, y: blockTop - 56 }, end: { x: x + colW, y: blockTop - 56 }, thickness: 0.75, color: INK });
  }

  page.drawText(pdfSafe(signer.name), { x: MARGIN, y: blockTop - 70, size: 10, font: bold, color: INK });
  page.drawText(pdfSafe(signer.title), { x: MARGIN, y: blockTop - 82, size: 8.5, font, color: MUTED });
  page.drawText(pdfSafe(longDate(d.agreementDate) || ''), { x: MARGIN, y: blockTop - 100, size: 9.5, font, color: INK });

  page.drawText(pdfSafe(typedName), { x: rightX, y: blockTop - 70, size: 10, font: bold, color: INK });
  page.drawText(
    pdfSafe(`${d.clientTitle || ''}${d.clientBusiness ? `, ${d.clientBusiness}` : ''}`),
    { x: rightX, y: blockTop - 82, size: 8.5, font, color: MUTED }
  );
  page.drawText(pdfSafe(signedAtLong), { x: rightX, y: blockTop - 100, size: 9.5, font, color: INK });

  for (const x of [MARGIN, rightX]) {
    page.drawLine({ start: { x, y: blockTop - 106 }, end: { x: x + colW, y: blockTop - 106 }, thickness: 0.5, color: RULE });
    page.drawText('DATE', { x, y: blockTop - 118, size: 7.5, font, color: MUTED });
  }
  y = blockTop - 130;

  paragraph(
    'Signed electronically through tradeleadsmarketing.com. An electronic signature applied this way ' +
    'has the same effect as a signature in ink.',
    { size: 8.5 }
  );

  /* ---------- page furniture ---------- */
  const pages = pdf.getPages();
  pages.forEach((pg, i) => {
    pg.drawText(pdfSafe(`${AGENCY.name} — Marketing Services Agreement`), {
      x: MARGIN, y: 30, size: 7.5, font, color: MUTED
    });
    const label = pdfSafe(`${reference}   ${i + 1} of ${pages.length}`);
    pg.drawText(label, {
      x: PAGE_W - MARGIN - font.widthOfTextAtSize(label, 7.5), y: 30, size: 7.5, font, color: MUTED
    });
  });

  return Buffer.from(await pdf.save());
}
