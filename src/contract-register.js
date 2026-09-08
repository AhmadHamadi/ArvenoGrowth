/**
 * A local register of every agreement the generator has produced.
 *
 * There is no database behind this site, so the authoritative archive is the
 * inbox: every signed agreement emails itself to the office with a consistent
 * subject and the full terms attached. This register is the working copy — it
 * answers "what did we send, to whom, and has it come back yet", which an inbox
 * cannot without hunting.
 *
 * It lives in localStorage, so it is per browser. Export writes a JSON file that
 * can be kept anywhere and imported on another machine.
 */

import { money, longDate, slugify, signingUrl, guaranteeFlags, selectedServices } from './contract-model.js';

export const REGISTER_KEY = 'tlm_contract_register_v1';

export function reference(d) {
  const slug = slugify(d.clientBusiness).toUpperCase().replace(/-/g, '').slice(0, 6);
  const date = String(d.agreementDate || '').replace(/-/g, '').slice(2) || '000000';
  return `TLM-${slug || 'AGREE'}-${date}`;
}

export function readRegister() {
  try {
    const raw = localStorage.getItem(REGISTER_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeRegister(list) {
  try {
    localStorage.setItem(REGISTER_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

/** Snapshot of a contract, small enough to keep hundreds of them. */
export function toEntry(d, origin) {
  const g = guaranteeFlags(d);
  return {
    ref: reference(d),
    business: d.clientBusiness || '',
    contact: d.clientContact || '',
    email: d.clientEmail || '',
    agreementDate: d.agreementDate || '',
    setupStart: d.setupStart || '',
    setupFee: money(d.setupFee, d.currency) || '',
    monthlyFee: money(d.monthlyFee, d.currency) || '',
    term: d.term || '',
    currency: d.currency || 'CAD',
    services: selectedServices(d).map((s) => s.label),
    guarantee: d.guarantee || 'none',
    guaranteeLabel: g.both ? 'Both clauses'
      : g.bookings ? '30-day bookings'
      : g.performance ? 'No-trap'
      : 'None',
    signer: d.signerIndex || 0,
    link: signingUrl(d, origin),
    createdAt: new Date().toISOString(),
    status: 'sent'   // sent | signed | archived
  };
}

/** Adds or refreshes an entry, keyed on the reference. Returns the new list. */
export function saveEntry(entry) {
  const list = readRegister();
  const i = list.findIndex((x) => x.ref === entry.ref);
  if (i >= 0) {
    // keep whatever status it had already reached
    list[i] = { ...entry, status: list[i].status, createdAt: list[i].createdAt };
  } else {
    list.unshift(entry);
  }
  writeRegister(list);
  return list;
}

export function updateStatus(ref, status) {
  const list = readRegister().map((x) => (x.ref === ref ? { ...x, status } : x));
  writeRegister(list);
  return list;
}

export function removeEntry(ref) {
  const list = readRegister().filter((x) => x.ref !== ref);
  writeRegister(list);
  return list;
}

export function exportRegister() {
  const list = readRegister();
  const blob = new Blob([JSON.stringify({ exported: new Date().toISOString(), contracts: list }, null, 2)],
    { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tlm-contracts-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return list.length;
}

/** Merges an exported file back in without losing anything already here. */
export function importRegister(json) {
  let incoming;
  try {
    const parsed = JSON.parse(json);
    incoming = Array.isArray(parsed) ? parsed : parsed.contracts;
  } catch {
    throw new Error('That file is not a contract export.');
  }
  if (!Array.isArray(incoming)) throw new Error('That file has no contracts in it.');

  const list = readRegister();
  const byRef = new Map(list.map((x) => [x.ref, x]));
  let added = 0;
  for (const entry of incoming) {
    if (!entry || typeof entry !== 'object' || !entry.ref) continue;
    if (!byRef.has(entry.ref)) { byRef.set(entry.ref, entry); added++; }
  }
  const merged = [...byRef.values()].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  writeRegister(merged);
  return { added, total: merged.length };
}

export const prettyDate = (iso) => longDate(String(iso).slice(0, 10)) || '—';
