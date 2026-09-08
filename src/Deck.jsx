import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Printer, Phone, Maximize2, Minimize2 } from 'lucide-react';
import {
  AGENCY, LEAKS, TRADES, THREE, CPL, MATH, PROCESS, SERVICES, REPORTING, OFFER, QUOTES
} from './deck-content.js';

/* ============================================================
   TRADE LEADS MARKETING — /deck

   The pitch, as a link rather than a file. Twelve slides in the
   same work-order language as the rest of the site: warm paper
   ground, warm near-black ink, safety orange as the only accent,
   hairline rules, square corners, dark slides to punctuate.

   Every slide is drawn on a fixed 1280x720 stage which is then
   scaled to whatever viewport it lands in. That is what keeps a
   deck looking identical on a laptop, a projector, and a phone —
   the alternative, reflowing each slide responsively, means the
   layout you rehearsed is not the layout that shows up.

   Printing switches the stage to a stacked, page-per-slide layout
   so "Save as PDF" produces the same twelve landscape pages.
   ============================================================ */

const STAGE_W = 1280;
const STAGE_H = 720;
const TOTAL = 12;

/* ============================================================
   STAGE — scales the fixed slide to fit the viewport
   ============================================================ */
function useStageScale() {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const fit = () => {
      // Leave room for the control bar on short viewports
      const pad = window.innerWidth < 700 ? 16 : 48;
      const availW = window.innerWidth - pad;
      const availH = window.innerHeight - (window.innerWidth < 700 ? 96 : 112);
      setScale(Math.min(availW / STAGE_W, availH / STAGE_H));
    };
    fit();
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', fit);
    return () => {
      window.removeEventListener('resize', fit);
      window.removeEventListener('orientationchange', fit);
    };
  }, []);

  return scale;
}

/* ============================================================
   SLIDE PRIMITIVES
   ============================================================ */
const M = 80;                          // stage margin, matches the deck file
const BODY_W = STAGE_W - M * 2;

function Slide({ dark = false, kicker, n, children }) {
  return (
    <section
      className={`deck-slide relative overflow-hidden ${dark ? 'bg-inkd text-paper' : 'bg-paper text-inkd'}`}
      style={{ width: STAGE_W, height: STAGE_H }}
      aria-label={`Slide ${n} of ${TOTAL}`}
    >
      <div className="absolute inset-x-0 top-0 h-[7px] bg-brand" />
      {kicker && (
        <div
          className={`absolute font-plex text-[13px] font-bold uppercase tracking-[0.2em] ${dark ? 'text-brandpress' : 'text-brandink'}`}
          style={{ left: M, top: 34 }}
        >
          {kicker}
        </div>
      )}
      <div
        className={`absolute font-plex text-[13px] tabular-nums ${dark ? 'text-paper/45' : 'text-inkd3'}`}
        style={{ right: M, top: 34 }}
      >
        {String(n).padStart(2, '0')} / {TOTAL}
      </div>
      {children}
    </section>
  );
}

const Heading = ({ children, dark, top = 92, size = 54 }) => (
  <h2
    className={`absolute font-archivo font-extrabold tracking-[-0.025em] ${dark ? 'text-paper' : 'text-inkd'}`}
    style={{ left: M, top, width: BODY_W, fontSize: size, lineHeight: 1.06 }}
  >
    {children}
  </h2>
);

const Rule = ({ top, dark, left = M, width = BODY_W }) => (
  <div
    className={`absolute ${dark ? 'bg-paper/25' : 'bg-paperEdge'}`}
    style={{ left, top, width, height: 1.5 }}
  />
);

const Body = ({ children, dark, top, left = M, width = BODY_W, size = 21 }) => (
  <p
    className={`absolute font-archivo ${dark ? 'text-paper/70' : 'text-inkd2'}`}
    style={{ left, top, width, fontSize: size, lineHeight: 1.55 }}
  >
    {children}
  </p>
);

const Note = ({ children, dark, top }) => (
  <p
    className={`absolute font-archivo ${dark ? 'text-paper/45' : 'text-inkd3'}`}
    style={{ left: M, top, width: BODY_W, fontSize: 15, lineHeight: 1.5 }}
  >
    {children}
  </p>
);

/* ============================================================
   THE TWELVE SLIDES
   ============================================================ */
const SLIDES = [
  /* 01 — cover */
  { dark: true, render: (n) => (
    <Slide dark n={n}>
      <div className="absolute font-plex text-[16px] font-bold uppercase tracking-[0.3em] text-brandpress" style={{ left: M, top: 196 }}>
        {AGENCY.name}
      </div>
      <h1 className="absolute font-archivo font-extrabold tracking-[-0.035em] text-paper"
        style={{ left: M, top: 240, width: BODY_W, fontSize: 74, lineHeight: 1.02 }}>
        Marketing that puts<br />trucks on driveways.
      </h1>
      <Rule top={482} dark />
      <Body dark top={506} width={BODY_W - 40}>
        We only work with contractors. Google Ads, local SEO, and websites built around booked
        jobs — not clicks, not impressions, not reports nobody reads.
      </Body>
      <div className="absolute font-plex text-[15px] text-paper/50" style={{ left: M, top: 620 }}>
        {AGENCY.site}&nbsp;&nbsp;&nbsp;&nbsp;{AGENCY.phone}&nbsp;&nbsp;&nbsp;&nbsp;{AGENCY.email}
      </div>
    </Slide>
  )},

  /* 02 — the problem */
  { render: (n) => (
    <Slide kicker="The problem" n={n}>
      <Heading>Impressions do not<br />pour concrete.</Heading>
      <Rule top={272} />
      <Body top={300} width={560}>
        Most contractors are sold traffic. Traffic is not the job. The gap between a click and a
        signed estimate is where the money goes missing, and almost nobody measures it.
      </Body>
      {LEAKS.map(([t, d], i) => (
        <div key={t} className="absolute" style={{ left: 700, top: 296 + i * 88, width: 500 }}>
          <div className="absolute left-0 top-1 w-[4px] bg-brandink" style={{ height: 54 }} />
          <div className="pl-6">
            <div className="font-archivo text-[21px] font-bold text-inkd">{t}</div>
            <div className="mt-1 font-archivo text-[17px] text-inkd3">{d}</div>
          </div>
        </div>
      ))}
    </Slide>
  )},

  /* 03 — only contractors */
  { render: (n) => (
    <Slide kicker="Who we are" n={n}>
      <Heading>We only work<br />with contractors.</Heading>
      <Rule top={272} />
      <Body top={300} width={BODY_W - 60}>
        Not law firms. Not e-commerce. Trades, every day — roofing, HVAC, concrete, plumbing,
        electrical, landscaping, paving, builders and renovators. That focus is the whole advantage:
        we already know what a qualified lead looks like in your trade, and what it should cost.
      </Body>
      <div className="absolute flex flex-wrap gap-3" style={{ left: M, top: 470, width: BODY_W }}>
        {TRADES.map((t) => (
          <span key={t} className="border border-paperEdge bg-paper2 px-5 py-2.5 font-archivo text-[18px] text-inkd2">
            {t}
          </span>
        ))}
      </div>
    </Slide>
  )},

  /* 04 — three things */
  { render: (n) => (
    <Slide kicker="What actually moves the phone" n={n}>
      <Heading>Three things, working together.</Heading>
      <Note top={222}>Fix one and you get a bump. Fix all three and the phone changes character.</Note>
      <Rule top={272} />
      {THREE.map(([num, title, body], i) => (
        <div key={num} className="absolute" style={{ left: M + i * ((BODY_W - 90) / 3 + 45), top: 316, width: (BODY_W - 90) / 3 }}>
          <div className="font-archivo text-[58px] font-extrabold leading-none text-paperEdge">{num}</div>
          <div className="mt-5 font-archivo text-[25px] font-bold text-inkd">{title}</div>
          <p className="mt-3 font-archivo text-[18px] leading-[1.55] text-inkd2">{body}</p>
        </div>
      ))}
    </Slide>
  )},

  /* 05 — what a lead costs */
  { dark: true, render: (n) => (
    <Slide dark kicker="Know the number before you spend" n={n}>
      <Heading dark size={48}>What a lead actually costs<br />in your trade.</Heading>
      <Note dark top={252}>
        Google Ads search cost per lead, USD. Compiled from LocaliQ 2025 home-services benchmarks
        (3,211 campaigns) and trade-specific agency data, cross-checked per trade.
      </Note>
      <table className="absolute border-collapse" style={{ left: M, top: 322, width: BODY_W }}>
        <thead>
          <tr>
            {CPL.head.map((h, i) => (
              <th key={h} className={`border-b border-paper/25 pb-2.5 font-plex text-[12px] font-bold uppercase tracking-[0.16em] text-brandpress ${i ? 'text-right' : 'text-left'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CPL.rows.map((r) => (
            <tr key={r[0]}>
              {r.map((c, i) => (
                <td key={i} className={`border-b border-paper/12 py-[9px] font-archivo text-[20px] ${i ? 'text-right tabular-nums text-paper/85' : 'font-bold text-paper'}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {/* Measured, not guessed: six rows at this padding put the table bottom
          at 646, so the note starts below that and still clears the 720 edge. */}
      <Note dark top={666}>
        Your market, service area and season move these. We price the plan off your numbers, not a table.
      </Note>
    </Slide>
  )},

  /* 06 — break-even math */
  { render: (n) => (
    <Slide kicker="The only math that matters" n={n}>
      <Heading>One job pays for the month.</Heading>
      <Rule top={248} />
      {MATH.map(([big, small], i) => (
        <div key={small} className="absolute" style={{ left: M + i * ((BODY_W - 64) / 5 + 16), top: 292, width: (BODY_W - 64) / 5 }}>
          <div className={`font-archivo text-[40px] font-extrabold leading-none tracking-[-0.03em] ${i === 4 ? 'text-brandink' : 'text-inkd'}`}>
            {big}
          </div>
          <div className="mt-3 font-archivo text-[17px] leading-snug text-inkd3">{small}</div>
        </div>
      ))}
      <div className="absolute bg-inkd" style={{ left: M, top: 452, width: BODY_W, height: 132 }}>
        <div className="absolute inset-y-0 left-0 w-[6px] bg-brand" />
        <p className="px-9 py-7 font-archivo text-[22px] leading-[1.5] text-paper">
          Roughly $24,000 of work from $2,000 of ad spend. The first job covers the spend and our
          fee. Everything after it is margin.
        </p>
      </div>
      <Note top={606}>
        Illustrative, using the concrete benchmarks on the previous slide. Not a projection of your results.
      </Note>
    </Slide>
  )},

  /* 07 — process */
  { dark: true, render: (n) => (
    <Slide dark kicker="Our process" n={n}>
      <Heading dark size={50}>Five steps. Every client,<br />every time.</Heading>
      <Rule top={288} dark />
      {PROCESS.map(([num, title, body], i) => (
        <div key={num} className="absolute" style={{ left: M + i * ((BODY_W - 80) / 5 + 20), top: 330, width: (BODY_W - 80) / 5 }}>
          <div className="font-archivo text-[42px] font-extrabold leading-none text-paper/20">{num}</div>
          <div className="mt-4 font-archivo text-[23px] font-bold text-paper">{title}</div>
          <p className="mt-2.5 font-archivo text-[16px] leading-[1.5] text-paper/60">{body}</p>
        </div>
      ))}
    </Slide>
  )},

  /* 08 — what you get */
  { render: (n) => (
    <Slide kicker="What you get" n={n}>
      <Heading>Everything, run by one team.</Heading>
      <Rule top={248} />
      {SERVICES.map(([t, d], i) => (
        <div key={t} className="absolute" style={{ left: M + (i % 2) * (BODY_W / 2 + 20), top: 292 + Math.floor(i / 2) * 132, width: BODY_W / 2 - 20 }}>
          <div className="absolute left-0 top-1 w-[4px] bg-brandink" style={{ height: 72 }} />
          <div className="pl-6">
            <div className="font-archivo text-[22px] font-bold text-inkd">{t}</div>
            <p className="mt-1.5 font-archivo text-[17px] leading-[1.5] text-inkd3">{d}</p>
          </div>
        </div>
      ))}
    </Slide>
  )},

  /* 09 — reporting */
  { render: (n) => (
    <Slide kicker="Reporting" n={n}>
      <Heading>We report booked jobs,<br />not clicks.</Heading>
      <Rule top={272} />
      <Body top={300} width={540}>
        Call tracking, form tracking, and conversion tracking go in before a dollar is spent. You see
        which campaign, which ad, and which keyword booked the job — and what it cost you to get it.
      </Body>
      <div className="absolute" style={{ left: 700, top: 292, width: 500 }}>
        {REPORTING.map(([good, bad]) => (
          <div key={good} className="flex items-baseline justify-between gap-6 border-b border-paperEdge py-4">
            <span className="font-archivo text-[21px] font-bold text-inkd">{good}</span>
            <span className="shrink-0 font-archivo text-[17px] italic text-inkd3">{bad}</span>
          </div>
        ))}
      </div>
    </Slide>
  )},

  /* 10 — the offer */
  { dark: true, render: (n) => (
    <Slide dark kicker="The offer" n={n}>
      <Heading dark>No lock-in. No trap.</Heading>
      <Rule top={248} dark />
      {OFFER.map(([t, d], i) => (
        <div key={t} className="absolute" style={{ left: M, top: 292 + i * 100, width: BODY_W }}>
          <div className="absolute left-0 top-1 w-[4px] bg-brand" style={{ height: 62 }} />
          <div className="pl-6">
            <div className="font-archivo text-[23px] font-bold text-paper">{t}</div>
            <p className="mt-1.5 font-archivo text-[18px] leading-[1.5] text-paper/60">{d}</p>
          </div>
        </div>
      ))}
    </Slide>
  )},

  /* 11 — proof */
  { render: (n) => (
    <Slide kicker="What contractors say" n={n}>
      <Heading>Ask them yourself.</Heading>
      <Rule top={242} />
      {QUOTES.map(([q, name, where], i) => (
        <div key={name} className="absolute" style={{ left: M + i * ((BODY_W - 80) / 3 + 40), top: 286, width: (BODY_W - 80) / 3 }}>
          <div className="h-[4px] w-full bg-brandink" />
          <p className="mt-5 font-archivo text-[17px] leading-[1.6] text-inkd2">“{q}”</p>
          <div className="mt-6 font-archivo text-[19px] font-bold text-inkd">{name}</div>
          <div className="mt-0.5 font-plex text-[13px] text-inkd3">{where}</div>
        </div>
      ))}
      <Note top={644}>Real contractors, real campaigns. Reach out to any of them directly if you want to check.</Note>
    </Slide>
  )},

  /* 12 — next step */
  { dark: true, render: (n) => (
    <Slide dark kicker="Next step" n={n}>
      <h2 className="absolute font-archivo font-extrabold tracking-[-0.03em] text-paper"
        style={{ left: M, top: 160, width: BODY_W, fontSize: 62, lineHeight: 1.04 }}>
        A free audit.<br />You keep what we find.
      </h2>
      <Rule top={376} dark />
      <Body dark top={404} width={BODY_W - 60}>
        Thirty minutes. We go through your website, Google Business Profile, ad spend and tracking
        before we speak, then walk you through what is helping, what is wasting money, and what to
        fix first. No obligation, and the findings are yours either way.
      </Body>
      <a
        href={`https://${AGENCY.apply}`}
        className="absolute inline-flex items-center bg-brand px-10 font-archivo text-[20px] font-bold uppercase tracking-[0.1em] text-inkd transition-colors hover:bg-paper"
        style={{ left: M, top: 556, height: 68 }}
      >
        Book the audit
      </a>
      <div className="absolute font-plex text-[18px] leading-[1.5] text-paper/80" style={{ left: M + 340, top: 562 }}>
        {AGENCY.apply}<br />{AGENCY.phone}
      </div>
    </Slide>
  )}
];

/* ============================================================
   PAGE
   ============================================================ */
export default function Deck() {
  const [i, setI] = useState(() => {
    const h = Number(String(window.location.hash).replace('#', ''));
    return Number.isFinite(h) && h >= 1 && h <= TOTAL ? h - 1 : 0;
  });
  const [full, setFull] = useState(false);
  const scale = useStageScale();
  const touch = useRef(null);

  const go = useCallback((next) => {
    setI((cur) => {
      const v = Math.max(0, Math.min(TOTAL - 1, typeof next === 'function' ? next(cur) : next));
      window.history.replaceState(null, '', `#${v + 1}`);
      return v;
    });
  }, []);

  const toggleFull = useCallback(() => {
    const el = document.documentElement;
    if (!document.fullscreenElement) el.requestFullscreen?.().then(() => setFull(true)).catch(() => {});
    else document.exitFullscreen?.().then(() => setFull(false)).catch(() => {});
  }, []);

  /* Keyboard: the keys people actually press in a deck, plus the ones a
     presentation remote sends (Page Up / Page Down). */
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key) {
        case 'ArrowRight': case 'ArrowDown': case ' ': case 'PageDown': case 'Enter':
          e.preventDefault(); go((c) => c + 1); break;
        case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace':
          e.preventDefault(); go((c) => c - 1); break;
        case 'Home': e.preventDefault(); go(0); break;
        case 'End':  e.preventDefault(); go(TOTAL - 1); break;
        case 'f':    e.preventDefault(); toggleFull(); break;
        default: break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, toggleFull]);

  useEffect(() => {
    const onHash = () => {
      const h = Number(String(window.location.hash).replace('#', ''));
      if (Number.isFinite(h) && h >= 1 && h <= TOTAL) setI(h - 1);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const onFs = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  /* Swipe, so the deck works when it is opened on a phone */
  const onTouchStart = (e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = (e) => {
    if (!touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy)) go((c) => c + (dx < 0 ? 1 : -1));
    touch.current = null;
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#0B0A08]">
      <style>{`
        @page { size: 1280px 720px; margin: 0; }
        @media print {
          html, body { background: #fff !important; }
          .no-print { display: none !important; }
          .deck-viewport { display: block !important; padding: 0 !important; }
          .deck-stage { position: static !important; transform: none !important; width: auto !important; height: auto !important; }
          .deck-print-all { display: block !important; }
          .deck-live { display: none !important; }
          .deck-slide { break-after: page; page-break-after: always; }
          .deck-slide:last-child { break-after: auto; page-break-after: auto; }
        }
        .deck-print-all { display: none; }
      `}</style>

      {/* ---------- The slide ---------- */}
      <main
        className="deck-viewport flex flex-1 items-center justify-center overflow-hidden p-4 md:p-6"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="deck-live" style={{ width: STAGE_W * scale, height: STAGE_H * scale }}>
          <div
            className="deck-stage origin-top-left shadow-[0_18px_50px_rgba(0,0,0,0.5)]"
            style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})` }}
          >
            {SLIDES[i].render(i + 1)}
          </div>
        </div>

        {/* Every slide, stacked, for Save as PDF */}
        <div className="deck-print-all">
          {SLIDES.map((s, idx) => <div key={idx}>{s.render(idx + 1)}</div>)}
        </div>
      </main>

      {/* ---------- Controls ---------- */}
      <footer className="no-print border-t border-white/10 bg-[#0B0A08] px-4 py-3 md:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => go((c) => c - 1)} disabled={i === 0}
              aria-label="Previous slide"
              className="flex h-11 w-11 items-center justify-center border border-white/20 text-paper transition-colors hover:bg-white/10 disabled:opacity-30"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => go((c) => c + 1)} disabled={i === TOTAL - 1}
              aria-label="Next slide"
              className="flex h-11 w-11 items-center justify-center border border-white/20 text-paper transition-colors hover:bg-white/10 disabled:opacity-30"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <span className="ml-2 font-plex text-[12px] tabular-nums text-paper/50">
              {String(i + 1).padStart(2, '0')} / {TOTAL}
            </span>
          </div>

          {/* Jump straight to any slide */}
          <div className="hidden flex-1 items-center gap-1.5 px-4 sm:flex">
            {SLIDES.map((_, idx) => (
              <button
                key={idx} onClick={() => go(idx)}
                aria-label={`Go to slide ${idx + 1}`}
                aria-current={idx === i ? 'true' : undefined}
                className={`h-1.5 flex-1 transition-colors ${idx === i ? 'bg-brand' : 'bg-white/20 hover:bg-white/40'}`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <a
              href={AGENCY.phoneHref}
              className="hidden h-11 items-center gap-2 border border-white/20 px-4 font-plex text-[12px] text-paper transition-colors hover:bg-white/10 md:flex"
            >
              <Phone className="h-4 w-4 text-brandpress" /> {AGENCY.phone}
            </a>
            <button
              onClick={() => window.print()} aria-label="Save as PDF"
              className="flex h-11 items-center gap-2 border border-white/20 px-4 font-plex text-[12px] text-paper transition-colors hover:bg-white/10"
            >
              <Printer className="h-4 w-4" /> <span className="hidden sm:inline">PDF</span>
            </button>
            <button
              onClick={toggleFull} aria-label={full ? 'Exit full screen' : 'Full screen'}
              className="flex h-11 w-11 items-center justify-center border border-white/20 text-paper transition-colors hover:bg-white/10"
            >
              {full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
