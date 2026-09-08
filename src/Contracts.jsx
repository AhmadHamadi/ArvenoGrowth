import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FileText, Copy, Check, ExternalLink, Trash2, Download, Upload,
  Plus, Search, AlertCircle
} from 'lucide-react';
import { AGENCY } from './contract-model.js';
import {
  readRegister, updateStatus, removeEntry, exportRegister, importRegister, prettyDate
} from './contract-register.js';

/* ============================================================
   TRADE LEADS MARKETING — /contracts  (internal register)

   Every agreement the generator has produced, on this machine.
   The inbox is still the archive of record: each signed agreement
   emails itself to the office with the full terms attached. This is
   the working list, which answers what the inbox cannot — what is
   out there, and whether it has come back.
   ============================================================ */

const STATUS = {
  sent:     { label: 'Awaiting signature', cls: 'border-brandink text-brandink' },
  signed:   { label: 'Signed',             cls: 'border-inkd bg-inkd text-paper' },
  archived: { label: 'Archived',           cls: 'border-paperEdge text-inkd3' }
};

function CopyLink({ text }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setDone(true); setTimeout(() => setDone(false), 1700);
    } catch { /* clipboard unavailable */ }
  };
  return (
    <button
      type="button" onClick={copy}
      className="inline-flex items-center gap-1.5 border border-inkd bg-white px-2.5 py-1.5 font-archivo text-[12.5px] font-semibold text-inkd transition-colors hover:bg-inkd hover:text-paper"
    >
      {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {done ? 'Copied' : 'Copy link'}
    </button>
  );
}

export default function Contracts() {
  const [list, setList] = useState([]);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [note, setNote] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => { setList(readRegister()); }, []);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return list
      .filter((x) => filter === 'all' || x.status === filter)
      .filter((x) => !needle || [x.business, x.contact, x.ref, x.email]
        .some((v) => String(v || '').toLowerCase().includes(needle)));
  }, [list, q, filter]);

  const counts = useMemo(() => ({
    all: list.length,
    sent: list.filter((x) => x.status === 'sent').length,
    signed: list.filter((x) => x.status === 'signed').length,
    archived: list.filter((x) => x.status === 'archived').length
  }), [list]);

  const onImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const { added, total } = importRegister(String(reader.result));
        setList(readRegister());
        setNote({ ok: true, text: `Imported ${added} new contract${added === 1 ? '' : 's'}. ${total} in the register.` });
      } catch (err) {
        setNote({ ok: false, text: err.message });
      }
      setTimeout(() => setNote(null), 4000);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="min-h-screen bg-paper font-archivo text-inkd antialiased">
      <header className="sticky top-0 z-40 border-b border-inkd bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3 md:px-8">
          <a href="/contract" className="flex items-center gap-4">
            <img src="/tlm-mark.png" alt="" className="h-14 w-14 shrink-0 object-contain" />
            <span className="leading-tight">
              <span className="block font-archivo text-[15px] font-extrabold uppercase tracking-[0.06em] text-inkd">
                Contract register
              </span>
              <span className="block font-archivo text-[12.5px] text-inkd3">Internal tool</span>
            </span>
          </a>
          <a
            href="/contract"
            className="inline-flex items-center gap-2 bg-brandink px-5 py-3 font-archivo text-[13px] font-bold uppercase tracking-[0.1em] text-paper transition-colors hover:bg-brandink2"
          >
            <Plus className="h-4 w-4" /> New contract
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14">
        <div className="flex items-baseline gap-4">
          <h1 className="font-archivo text-[30px] font-extrabold tracking-[-0.02em] text-inkd sm:text-[38px]">
            Every agreement you have sent
          </h1>
          <span className="hidden h-px flex-1 bg-paperEdge sm:block" />
        </div>
        <p className="mt-3 max-w-2xl font-archivo text-[15.5px] leading-[1.65] text-inkd2">
          Kept in this browser. The archive of record is your inbox: every signed agreement emails itself
          to {AGENCY.email} with the full terms attached. Export here to keep a copy anywhere else.
        </p>

        {/* Controls */}
        <div className="mt-8 flex flex-col gap-4 border-y border-inkd py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {[['all', 'All'], ['sent', 'Awaiting'], ['signed', 'Signed'], ['archived', 'Archived']].map(([k, label]) => (
              <button
                key={k} type="button" onClick={() => setFilter(k)}
                className={`border px-3 py-2 font-archivo text-[13.5px] font-semibold transition-colors
                  ${filter === k ? 'border-inkd bg-inkd text-paper' : 'border-paperEdge text-inkd2 hover:border-inkd'}`}
              >
                {label} <span className="font-plex text-[11px] tabular-nums opacity-60">{counts[k]}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 border border-paperEdge bg-white px-3 py-2">
              <Search className="h-4 w-4 text-inkd3" />
              <input
                value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Client, contact or reference"
                className="w-52 bg-transparent font-archivo text-[14px] text-inkd focus:outline-none"
                aria-label="Search contracts"
              />
            </label>
            <button
              type="button"
              onClick={() => { const n = exportRegister(); setNote({ ok: true, text: `Exported ${n} contract${n === 1 ? '' : 's'}.` }); setTimeout(() => setNote(null), 3000); }}
              className="inline-flex items-center gap-1.5 border border-inkd bg-white px-3 py-2 font-archivo text-[13.5px] font-semibold text-inkd transition-colors hover:bg-inkd hover:text-paper"
            >
              <Download className="h-4 w-4" /> Export
            </button>
            <button
              type="button" onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 border border-inkd bg-white px-3 py-2 font-archivo text-[13.5px] font-semibold text-inkd transition-colors hover:bg-inkd hover:text-paper"
            >
              <Upload className="h-4 w-4" /> Import
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" onChange={onImport} className="hidden" />
          </div>
        </div>

        {note && (
          <div className={`mt-4 border-l-[3px] px-4 py-3 font-archivo text-[14px] ${note.ok ? 'border-brandink bg-brandink/5 text-inkd' : 'border-gRed bg-gRed/5 text-inkd'}`}>
            {note.text}
          </div>
        )}

        {/* The list */}
        {shown.length === 0 ? (
          <div className="mt-14 border border-dashed border-paperEdge px-6 py-16 text-center">
            <FileText className="mx-auto h-7 w-7 text-inkd3" />
            <h2 className="mt-4 font-archivo text-[19px] font-bold text-inkd">
              {list.length === 0 ? 'Nothing here yet' : 'Nothing matches that'}
            </h2>
            <p className="mx-auto mt-2 max-w-md font-archivo text-[14.5px] leading-relaxed text-inkd2">
              {list.length === 0
                ? 'Contracts appear here the moment you generate a signing link on the contract page.'
                : 'Try a different search, or switch the filter back to All.'}
            </p>
            {list.length === 0 && (
              <a href="/contract" className="mt-6 inline-flex items-center gap-2 bg-brandink px-6 py-3.5 font-archivo text-[13px] font-bold uppercase tracking-[0.1em] text-paper">
                <Plus className="h-4 w-4" /> Make one
              </a>
            )}
          </div>
        ) : (
          <ul className="mt-8 border-t border-inkd">
            {shown.map((c) => {
              const st = STATUS[c.status] || STATUS.sent;
              return (
                <li key={c.ref} className="border-b border-paperEdge py-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <h3 className="font-archivo text-[18px] font-extrabold text-inkd">
                          {c.business || 'Untitled'}
                        </h3>
                        <span className={`border px-2 py-0.5 font-plex text-[10px] font-semibold uppercase tracking-[0.14em] ${st.cls}`}>
                          {st.label}
                        </span>
                      </div>
                      <div className="mt-1 font-archivo text-[14px] text-inkd2">
                        {[c.contact, c.email].filter(Boolean).join(' · ') || '—'}
                      </div>
                      <dl className="mt-3 flex flex-wrap gap-x-7 gap-y-1.5 font-archivo text-[13.5px] text-inkd2">
                        {[
                          ['Reference', c.ref],
                          ['Dated', prettyDate(c.agreementDate)],
                          ['Setup', c.setupFee || '—'],
                          ['Monthly', c.monthlyFee || '—'],
                          ['Term', c.term || '—'],
                          ['Guarantee', c.guaranteeLabel || '—']
                        ].map(([k, v]) => (
                          <div key={k} className="flex gap-1.5">
                            <dt className="text-inkd3">{k}</dt>
                            <dd className="font-semibold text-inkd">{v}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <a
                        href={c.link} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1.5 border border-inkd bg-white px-2.5 py-1.5 font-archivo text-[12.5px] font-semibold text-inkd transition-colors hover:bg-inkd hover:text-paper"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Open
                      </a>
                      <CopyLink text={c.link} />
                      <select
                        value={c.status}
                        onChange={(e) => setList(updateStatus(c.ref, e.target.value))}
                        aria-label={`Status for ${c.business}`}
                        className="border border-paperEdge bg-white px-2.5 py-1.5 font-archivo text-[12.5px] font-semibold text-inkd focus:outline-none"
                      >
                        <option value="sent">Awaiting</option>
                        <option value="signed">Signed</option>
                        <option value="archived">Archived</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Remove ${c.business} from the register? The emailed copy is not affected.`)) {
                            setList(removeEntry(c.ref));
                          }
                        }}
                        aria-label={`Remove ${c.business}`}
                        className="border border-paperEdge px-2.5 py-1.5 text-inkd3 transition-colors hover:border-gRed hover:text-gRed"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-12 flex items-start gap-3 border-t border-paperEdge pt-6">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-inkd3" />
          <p className="max-w-2xl font-archivo text-[13.5px] leading-relaxed text-inkd3">
            This list lives in this browser only. Clearing site data will empty it, and it will not appear on
            another machine until you import an export file. Signed agreements themselves are safe either way,
            because each one is emailed to {AGENCY.email} with the full terms attached.
          </p>
        </div>
      </main>
    </div>
  );
}
