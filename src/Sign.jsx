import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, RotateCcw, Loader2, Printer, Phone, AlertTriangle } from 'lucide-react';
import ContractDocument from './ContractDocument.jsx';
import {
  decodeContract, AGENCY, SIGNERS, longDate, todayISO, slugify
} from './contract-model.js';

/* ============================================================
   TRADE LEADS MARKETING — /sign

   The page a client opens from the covering email. It decodes the
   agreement out of the link, shows a prompt pointing down to the
   signature block, and emails both parties a signed copy.
   ============================================================ */

const PHONE_HREF = 'tel:+12894891167';

const PageStyle = () => (
  <style>{`
    @page { size: Letter portrait; margin: 14mm 14mm 12mm; }
    .contract-sheet {
      width: 8.5in;
      max-width: 100%;
      padding: 0.55in 0.6in;
      font-family: 'Archivo', system-ui, sans-serif;
    }
    .contract-clause, .contract-signatures { break-inside: avoid; page-break-inside: avoid; }
    @media print {
      html, body { background: #fff !important; }
      .no-print { display: none !important; }
      .print-area { position: static !important; padding: 0 !important; margin: 0 !important; }
      .contract-sheet {
        width: auto !important;
        padding: 0 !important;
        border: 0 !important;
        box-shadow: none !important;
        margin: 0 !important;
      }
    }
    @keyframes nudge { 0%,100% { transform: translateY(0); } 50% { transform: translateY(7px); } }
    .nudge { animation: nudge 1.6s ease-in-out infinite; }
    @media (prefers-reduced-motion: reduce) { .nudge { animation: none; } }
  `}</style>
);

/* ============================================================
   SIGNATURE PAD
   ============================================================ */
function SignaturePad({ value, onChange }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const latest = useRef(value);
  const [hasInk, setHasInk] = useState(Boolean(value));

  useEffect(() => { latest.current = value; }, [value]);

  /* Size the backing store to the device pixel ratio so the line is crisp and
     the exported PNG is high enough resolution to print. Reads the signature
     through a ref, because the resize listener is registered once and a stale
     closure would wipe an existing signature on the next resize. */
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const prior = latest.current;

    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#15140F';

    if (prior) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = prior;
    }
  }, []);

  useEffect(() => {
    setupCanvas();
    window.addEventListener('resize', setupCanvas);
    return () => window.removeEventListener('resize', setupCanvas);
  }, [setupCanvas]);

  const pos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e) => {
    e.preventDefault();
    canvasRef.current.setPointerCapture?.(e.pointerId);
    drawing.current = true;
    last.current = pos(e);
  };

  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    setHasInk(true);
  };

  const end = (e) => {
    if (!drawing.current) return;
    drawing.current = false;
    canvasRef.current.releasePointerCapture?.(e.pointerId);
    onChange(canvasRef.current.toDataURL('image/png'));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    onChange('');
  };

  return (
    <div>
      <div className="relative border-2 border-dashed border-paperEdge bg-white">
        <canvas
          ref={canvasRef}
          className="block h-[150px] w-full cursor-crosshair touch-none"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          onPointerCancel={end}
        />
        {!hasInk && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 text-inkd3">
            <span className="font-plex text-[10px] uppercase tracking-[0.2em]">Sign here</span>
            <span className="font-archivo text-[13px]">Use your finger, mouse, or trackpad</span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-8 bottom-5 border-b border-paperEdge" />
      </div>
      <button
        type="button" onClick={clear}
        className="mt-2 inline-flex items-center gap-1.5 font-plex text-[10px] uppercase tracking-[0.14em] text-inkd3 transition-colors hover:text-gRed"
      >
        <RotateCcw className="h-3.5 w-3.5" /> Clear signature
      </button>
    </div>
  );
}

/* ============================================================
   PAGE STATES
   ============================================================ */
function Shell({ children }) {
  return (
    <div className="min-h-screen bg-paper font-archivo text-inkd antialiased">
      <PageStyle />
      <header className="no-print border-b border-inkd bg-paper">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-5 py-3 md:px-8">
          <a href="/" className="flex items-center gap-4">
            <img src="/tlm-mark.png" alt="Trade Leads Marketing" className="h-14 w-14 object-contain md:h-16 md:w-16" />
            <span className="hidden h-10 w-px bg-paperEdge sm:block" />
            <span className="hidden leading-tight sm:block">
              <span className="block font-archivo text-[15px] font-extrabold uppercase tracking-[0.06em]">
                Trade Leads Marketing
              </span>
              <span className="block font-plex text-[9.5px] uppercase tracking-[0.22em] text-inkd3">
                Marketing services agreement
              </span>
            </span>
          </a>
          <a href={PHONE_HREF} className="group flex items-center gap-2.5 border border-inkd px-4 py-2.5 transition-colors hover:bg-inkd">
            <Phone className="h-4 w-4 text-brandink" />
            <span className="font-plex text-[12px] font-semibold tabular-nums transition-colors group-hover:text-paper">
              {AGENCY.phone}
            </span>
          </a>
        </div>
      </header>
      {children}
    </div>
  );
}

function Broken({ detail }) {
  return (
    <Shell>
      <main className="mx-auto max-w-2xl px-5 py-24 md:px-8">
        <AlertTriangle className="h-8 w-8 text-brandink" />
        <h1 className="mt-6 font-archivo text-[32px] font-extrabold leading-[1.05] tracking-[-0.02em]">
          This signing link is not readable.
        </h1>
        <p className="mt-4 font-archivo text-[16px] leading-relaxed text-inkd2">
          The link was probably shortened, wrapped, or cut in half by an email client. Copy the full address
          from the original email and paste it into your browser, or get in touch and we will resend it.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href={PHONE_HREF} className="inline-flex items-center gap-2.5 bg-inkd px-7 py-4 font-archivo text-[14px] font-bold uppercase tracking-[0.1em] text-paper transition-colors hover:bg-brand">
            <Phone className="h-4 w-4" /> {AGENCY.phone}
          </a>
          <a href={`mailto:${AGENCY.email}`} className="inline-flex items-center gap-2.5 border border-inkd px-7 py-4 font-archivo text-[14px] font-bold uppercase tracking-[0.1em] transition-colors hover:bg-inkd hover:text-paper">
            Email us
          </a>
        </div>
        {detail && (
          <p className="mt-8 border-t border-paperEdge pt-4 font-plex text-[10px] uppercase tracking-[0.12em] text-inkd3">
            {detail}
          </p>
        )}
      </main>
    </Shell>
  );
}

/* ============================================================
   SIGN
   ============================================================ */
export default function Sign() {
  const [state, setState] = useState({ phase: 'loading' });
  const [signature, setSignature] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [typedName, setTypedName] = useState('');
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [showNudge, setShowNudge] = useState(true);
  const signRef = useRef(null);

  /* Read the agreement out of the link */
  useEffect(() => {
    try {
      const token = new URLSearchParams(window.location.search).get('a');
      if (!token) {
        setState({ phase: 'broken', detail: 'No agreement found in the address' });
        return;
      }
      const d = decodeContract(token);
      setState({ phase: 'ready', d });
      setTypedName(d.clientContact || '');
    } catch (err) {
      setState({ phase: 'broken', detail: `Could not decode the agreement: ${err.message}` });
    }
  }, []);

  /* Hide the scroll prompt once they have started reading */
  useEffect(() => {
    const onScroll = () => setShowNudge(window.scrollY < 240);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const reference = useMemo(() => {
    if (state.phase !== 'ready') return '';
    const slug = slugify(state.d.clientBusiness).toUpperCase().replace(/-/g, '').slice(0, 6);
    return `TLM-${slug || 'AGREE'}-${String(state.d.agreementDate || '').replace(/-/g, '').slice(2) || '000000'}`;
  }, [state]);

  const jumpToSign = () => {
    signRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const submit = async (ev) => {
    ev.preventDefault();
    const e = {};
    if (!signature) e.signature = 'Please sign in the box above';
    if (typedName.trim().length < 2) e.typedName = 'Please type your full name';
    if (!agreed) e.agreed = 'Please confirm you have read and agree to the terms';
    setErrors(e);
    if (Object.keys(e).length) return;

    setSending(true);
    setSendError(null);
    try {
      const res = await fetch('/api/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: new URLSearchParams(window.location.search).get('a'),
          signature,
          typedName: typedName.trim(),
          signedAt: todayISO(),
          reference
        })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'We could not send the signed copy. Please call us and we will sort it out.');
      }
      setState((s) => ({ ...s, phase: 'signed' }));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setSendError(err.message);
    } finally {
      setSending(false);
    }
  };

  if (state.phase === 'loading') {
    return (
      <Shell>
        <main className="mx-auto max-w-2xl px-5 py-24 text-center md:px-8">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-inkd3" />
          <p className="mt-4 font-plex text-[11px] uppercase tracking-[0.2em] text-inkd3">Opening your agreement</p>
        </main>
      </Shell>
    );
  }

  if (state.phase === 'broken') return <Broken detail={state.detail} />;

  const { d } = state;
  const signer = SIGNERS[d.signerIndex] || SIGNERS[0];
  const signedDate = longDate(todayISO());
  const isSigned = state.phase === 'signed';

  return (
    <Shell>
      {/* ---------- Banner ---------- */}
      {isSigned ? (
        <section className="grain relative overflow-hidden border-b border-inkd bg-inkd text-paper">
          <div className="relative mx-auto max-w-4xl px-5 py-14 md:px-8 md:py-16">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, rotate: -6 }}
              animate={{ opacity: 1, scale: 1, rotate: -3 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="inline-block border-[3px] border-brand px-5 py-2.5"
            >
              <span className="font-plex text-[13px] font-bold uppercase tracking-[0.3em] text-brandink">Signed</span>
            </motion.div>
            <h1 className="mt-7 max-w-3xl font-archivo text-[2.4rem] font-extrabold leading-[1] tracking-[-0.03em] sm:text-5xl">
              That is done. <span className="text-brandink">Welcome aboard.</span>
            </h1>
            <p className="mt-5 max-w-xl font-archivo text-[16px] leading-relaxed text-paper/70">
              A copy of the signed agreement is on its way to {d.clientEmail || 'your inbox'} and to our office.
              We will be in touch about kickoff and account access.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={() => window.print()}
                className="no-print inline-flex items-center gap-2.5 bg-brandink px-7 py-4 font-archivo text-[14px] font-bold uppercase tracking-[0.1em] text-paper transition-colors hover:bg-paper hover:text-inkd"
              >
                <Printer className="h-4 w-4" /> Save your copy as PDF
              </button>
              <a
                href={PHONE_HREF}
                className="no-print inline-flex items-center gap-2.5 border border-paper/25 px-7 py-4 font-plex text-[13px] font-semibold tabular-nums text-paper transition-colors hover:border-paper"
              >
                <Phone className="h-4 w-4 text-brandink" /> {AGENCY.phone}
              </a>
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-[3px] bg-brand" />
        </section>
      ) : (
        <section className="no-print grain relative overflow-hidden border-b border-inkd bg-inkd text-paper">
          <div className="relative mx-auto max-w-4xl px-5 py-12 md:px-8 md:py-16">
            <div className="flex items-center gap-4">
              <span className="font-plex text-[10.5px] font-semibold uppercase tracking-[0.3em] text-brandink">
                Ready for signature
              </span>
              <span className="h-px w-20 bg-paper/25" />
              <span className="font-plex text-[10.5px] tabular-nums text-paper/45">{reference}</span>
            </div>

            <h1 className="mt-6 max-w-3xl font-archivo text-[2.3rem] font-extrabold leading-[1.02] tracking-[-0.03em] sm:text-5xl">
              {d.clientBusiness || 'Your'} agreement with
              <br />
              <span className="text-brandink">Trade Leads Marketing</span>
            </h1>

            <p className="mt-5 max-w-xl font-archivo text-[16px] leading-relaxed text-paper/70">
              Read it through, then scroll to the bottom to sign. It takes about a minute, and you will get a
              signed copy by email straight away.
            </p>

            {/* The prompt down to the signature block */}
            <AnimatePresence>
              {showNudge && (
                <motion.button
                  type="button"
                  onClick={jumpToSign}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="group mt-9 inline-flex items-center gap-4 border border-brand bg-brand/10 py-3 pl-5 pr-4 text-left transition-colors hover:bg-brand"
                >
                  <span>
                    <span className="block font-archivo text-[15px] font-bold text-paper">
                      Scroll down to sign
                    </span>
                    <span className="block font-plex text-[10px] uppercase tracking-[0.16em] text-paper/60 group-hover:text-paper/80">
                      Signature block at the bottom
                    </span>
                  </span>
                  <span className="nudge flex h-9 w-9 shrink-0 items-center justify-center bg-brandink text-paper group-hover:bg-paper group-hover:text-inkd">
                    <ChevronDown className="h-5 w-5" strokeWidth={2.5} />
                  </span>
                </motion.button>
              )}
            </AnimatePresence>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-[3px] bg-brand" />
        </section>
      )}

      {/* ---------- The agreement ---------- */}
      <main className="print-area mx-auto max-w-4xl px-5 py-10 md:px-8 md:py-14">
        <div className="overflow-x-auto">
          <div className="mx-auto w-fit border border-inkd bg-white shadow-[0_2px_0_0_#D6CFC0]">
            <ContractDocument
              d={d}
              tlmAttest
              clientSignature={isSigned ? signature : ''}
              clientSignedAt={isSigned ? signedDate : ''}
              reference={reference}
            />
          </div>
        </div>

        {/* ---------- Signature block ---------- */}
        {!isSigned && (
          <section ref={signRef} className="no-print mt-12 scroll-mt-6 border border-inkd bg-paper">
            <div className="flex items-center justify-between gap-4 border-b border-inkd bg-brandink px-5 py-2.5">
              <span className="font-plex text-[10px] font-semibold uppercase tracking-[0.22em] text-paper">
                Sign here
              </span>
              <span className="font-plex text-[10px] font-semibold tabular-nums text-paper/80">{reference}</span>
            </div>

            <form onSubmit={submit} className="px-5 py-8 md:px-8 md:py-10">
              <h2 className="max-w-xl font-archivo text-[24px] font-extrabold leading-[1.1] tracking-[-0.02em] sm:text-[30px]">
                Sign to accept this agreement
              </h2>
              <p className="mt-3 max-w-lg font-archivo text-[14.5px] leading-relaxed text-inkd2">
                {signer.name} has already signed for Trade Leads Marketing. Add your signature below and the
                agreement is complete.
              </p>

              <div className="mt-8 grid gap-8 md:grid-cols-2">
                <div>
                  <div className="font-plex text-[10px] font-semibold uppercase tracking-[0.18em] text-inkd2">
                    Your signature
                  </div>
                  <div className="mt-2">
                    <SignaturePad value={signature} onChange={(v) => { setSignature(v); setErrors((e) => ({ ...e, signature: null })); }} />
                  </div>
                  {errors.signature && (
                    <p className="mt-2 font-plex text-[10px] uppercase tracking-[0.1em] text-gRed">{errors.signature}</p>
                  )}
                </div>

                <div className="space-y-6">
                  <div>
                    <label htmlFor="typedName" className="font-plex text-[10px] font-semibold uppercase tracking-[0.18em] text-inkd2">
                      Print your full name
                    </label>
                    <input
                      id="typedName" type="text" autoComplete="name"
                      value={typedName}
                      onChange={(e) => { setTypedName(e.target.value); setErrors((x) => ({ ...x, typedName: null })); }}
                      className={`mt-1.5 w-full border-0 border-b bg-transparent px-0 pb-2 pt-1 font-archivo text-[16px] text-inkd transition-colors focus:border-brand focus:outline-none focus:ring-0 ${errors.typedName ? 'border-gRed' : 'border-inkd/25'}`}
                    />
                    {errors.typedName && (
                      <p className="mt-1.5 font-plex text-[10px] uppercase tracking-[0.1em] text-gRed">{errors.typedName}</p>
                    )}
                  </div>

                  <div>
                    <div className="font-plex text-[10px] font-semibold uppercase tracking-[0.18em] text-inkd2">Date</div>
                    <div className="mt-1.5 border-b border-inkd/25 pb-2 pt-1 font-archivo text-[16px] text-inkd">
                      {signedDate}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => { setAgreed((a) => !a); setErrors((e) => ({ ...e, agreed: null })); }}
                    aria-pressed={agreed}
                    className="flex w-full items-start gap-3 text-left"
                  >
                    <span className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center border transition-colors ${agreed ? 'border-brand bg-brandink' : 'border-inkd/40'}`}>
                      {agreed && <Check className="h-3 w-3 text-paper" strokeWidth={3.5} />}
                    </span>
                    <span className="font-archivo text-[13.5px] leading-snug text-inkd2">
                      I have read this agreement, I have authority to sign for{' '}
                      {d.clientBusiness || 'the Client'}, and I agree to its terms. I accept that an electronic
                      signature has the same effect as one in ink.
                    </span>
                  </button>
                  {errors.agreed && (
                    <p className="font-plex text-[10px] uppercase tracking-[0.1em] text-gRed">{errors.agreed}</p>
                  )}
                </div>
              </div>

              {sendError && (
                <div className="mt-7 border-l-[3px] border-gRed bg-gRed/5 px-4 py-3 font-archivo text-[13.5px] text-inkd">
                  {sendError}{' '}
                  <a href={PHONE_HREF} className="font-semibold underline decoration-brand decoration-2 underline-offset-2">
                    {AGENCY.phone}
                  </a>
                </div>
              )}

              <div className="mt-8 flex flex-col items-start gap-4 border-t border-paperEdge pt-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-sm font-plex text-[10px] uppercase leading-relaxed tracking-[0.1em] text-inkd3">
                  A signed copy is emailed to you and to our office the moment you submit.
                </p>
                <button
                  type="submit" disabled={sending}
                  className="inline-flex items-center gap-2.5 bg-brandink px-8 py-4 font-archivo text-[14px] font-bold uppercase tracking-[0.1em] text-paper transition-colors hover:bg-brandink2 disabled:opacity-60"
                >
                  {sending ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending</> : <>Sign and send</>}
                </button>
              </div>
            </form>
          </section>
        )}
      </main>

      <footer className="no-print border-t border-inkd bg-inkd px-5 py-8 text-paper md:px-8">
        <div className="mx-auto flex max-w-4xl flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <span className="font-plex text-[9.5px] uppercase tracking-[0.18em] text-paper/50">
            © {new Date().getFullYear()} {AGENCY.name}
          </span>
          <span className="font-plex text-[9.5px] uppercase tracking-[0.18em] text-paper/50">
            Questions before you sign? Call {AGENCY.phone}
          </span>
        </div>
      </footer>
    </Shell>
  );
}
