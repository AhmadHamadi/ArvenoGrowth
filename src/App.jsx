import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView, animate, useMotionValue, useTransform } from 'framer-motion';
import { Menu, X, ArrowRight, ArrowLeft, Phone, Plus } from 'lucide-react';

/* ============================================================
   TRADE LEADS MARKETING — HOMEPAGE

   Same design language as /apply: industrial utilitarian, set like
   trade paperwork. Warm paper ground, warm near-black ink, safety
   orange as the only accent, hairline rules and square corners
   instead of floating rounded cards.

   Type rule used throughout: monospace is only for short tags,
   numerals, and codes. Anything a person actually reads is Archivo,
   sentence case, at a size you can read across a truck cab.
   ============================================================ */

const PHONE_DISPLAY = '(289) 489-1167';
const PHONE_HREF    = 'tel:+12894891167';
const EMAIL         = 'info@tradeleadsmarketing.com';

const PageStyle = () => (
  <style>{`
    .grain::before {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      opacity: 0.5;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.28'/%3E%3C/svg%3E");
    }
    .rule-in { animation: ruleIn 0.8s cubic-bezier(0.22,1,0.36,1) both; transform-origin: left; }
    @keyframes ruleIn { from { transform: scaleX(0); } to { transform: scaleX(1); } }
    @media (prefers-reduced-motion: reduce) { .rule-in { animation: none; } }
  `}</style>
);

/* ---------- shared bits ---------- */
function Eyebrow({ children, tone = 'ink' }) {
  return (
    <span className={`font-plex text-[10.5px] font-semibold uppercase tracking-[0.28em] ${tone === 'ink' ? 'text-brand' : 'text-brand'}`}>
      {children}
    </span>
  );
}

function SectionHead({ kicker, title, sub, tone = 'ink' }) {
  const dark = tone === 'paper';
  return (
    <div>
      <div className="flex items-center gap-4">
        <Eyebrow>{kicker}</Eyebrow>
        <span className={`rule-in h-px flex-1 ${dark ? 'bg-paper/20' : 'bg-paperEdge'}`} />
      </div>
      <h2 className={`mt-5 max-w-3xl font-archivo text-[30px] font-extrabold leading-[1.06] tracking-[-0.028em] sm:text-[40px] ${dark ? 'text-paper' : 'text-inkd'}`}>
        {title}
      </h2>
      {sub && (
        <p className={`mt-4 max-w-2xl font-archivo text-[16.5px] leading-[1.65] ${dark ? 'text-paper/70' : 'text-inkd2'}`}>
          {sub}
        </p>
      )}
    </div>
  );
}

function Counter({ to = 100, suffix = '', decimals = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });
  const mv = useMotionValue(0);
  const out = useTransform(mv, (v) => `${Number(v.toFixed(decimals)).toLocaleString()}${suffix}`);
  useEffect(() => { if (inView) animate(mv, to, { duration: 1.4, ease: 'easeOut' }); }, [inView, mv, to]);
  return <motion.span ref={ref}>{out}</motion.span>;
}

/* ============================================================
   MASTHEAD
   ============================================================ */
function Masthead() {
  const [open, setOpen] = useState(false);
  const links = [
    ['Results', '#results'],
    ['Process', '#process'],
    ['Questions', '#faq'],
    ['Apply', '/apply']
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-inkd bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3 md:px-8">
        <a href="#top" className="flex items-center gap-4" aria-label="Trade Leads Marketing, home">
          <img src="/tlm-mark.png" alt="Trade Leads Marketing" className="h-14 w-14 object-contain md:h-16 md:w-16" />
          <span className="hidden h-10 w-px bg-paperEdge sm:block" />
          <span className="hidden leading-tight sm:block">
            <span className="block font-archivo text-[15px] font-extrabold uppercase tracking-[0.06em] text-inkd">
              Trade Leads Marketing
            </span>
            <span className="block font-archivo text-[12.5px] text-inkd3">Lead generation for trades</span>
          </span>
        </a>

        <nav className="hidden items-center gap-8 lg:flex">
          {links.map(([label, href]) => (
            <a key={href} href={href} className="font-archivo text-[14.5px] font-semibold text-inkd2 transition-colors hover:text-brand">
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          <a href={PHONE_HREF} className="group hidden items-center gap-2.5 border border-inkd px-4 py-2.5 transition-colors hover:bg-inkd sm:flex">
            <Phone className="h-4 w-4 text-brand" />
            <span className="font-plex text-[12px] font-semibold tabular-nums text-inkd transition-colors group-hover:text-paper">
              {PHONE_DISPLAY}
            </span>
          </a>
          <a href="#audit" className="hidden bg-brand px-5 py-3 font-archivo text-[13px] font-bold uppercase tracking-[0.1em] text-paper transition-colors hover:bg-brandpress lg:inline-block">
            Free audit
          </a>
          <button
            aria-label="Toggle menu"
            onClick={() => setOpen((o) => !o)}
            className="border border-inkd p-2.5 text-inkd lg:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-inkd bg-paper lg:hidden"
          >
            <div className="px-5 py-2">
              {links.map(([label, href]) => (
                <a
                  key={href} href={href} onClick={() => setOpen(false)}
                  className="block border-b border-paperEdge py-3.5 font-archivo text-[16px] font-semibold text-inkd"
                >
                  {label}
                </a>
              ))}
              <a href={PHONE_HREF} className="block border-b border-paperEdge py-3.5 font-plex text-[15px] font-semibold tabular-nums text-inkd">
                {PHONE_DISPLAY}
              </a>
              <a href="#audit" onClick={() => setOpen(false)} className="my-4 block bg-brand px-5 py-3.5 text-center font-archivo text-[14px] font-bold uppercase tracking-[0.1em] text-paper">
                Get a free audit
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

/* ============================================================
   HERO
   ============================================================ */
function Hero() {
  const facts = [
    ['01', 'Tracking from day one', 'Calls and forms attributed before a dollar is spent'],
    ['02', 'Month to month', 'No long contracts, cancel any time'],
    ['03', 'Contractors only', 'Not law firms, not e-commerce, just trades']
  ];

  return (
    <section id="top" className="border-b border-inkd bg-paper">
      <div className="mx-auto max-w-6xl px-5 pb-16 pt-12 md:px-8 md:pb-20 md:pt-16">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-7">
            <div className="flex items-center gap-4">
              <Eyebrow>Built for contractors</Eyebrow>
              <span className="rule-in h-px w-24 bg-paperEdge" />
            </div>

            <h1 className="mt-6 font-archivo text-[2.9rem] font-extrabold leading-[0.95] tracking-[-0.035em] text-inkd sm:text-6xl md:text-[4.5rem]">
              More contractor leads.
              <br />
              Better jobs.
              <br />
              <span className="text-brand">Less wasted ad spend.</span>
            </h1>

            <p className="mt-7 max-w-xl font-archivo text-[17.5px] leading-[1.7] text-inkd2">
              We build websites that convert, run Google Ads that stop bleeding money, and take over the local
              map pack, so you book more of the jobs you actually want.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-x-4 gap-y-3">
              <a
                href="/apply"
                className="group inline-flex items-center gap-2.5 bg-brand px-8 py-4 font-archivo text-[14px] font-bold uppercase tracking-[0.1em] text-paper transition-colors hover:bg-inkd"
              >
                Apply for a free audit
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
              <a
                href="#results"
                className="inline-flex items-center gap-2.5 border border-inkd px-8 py-4 font-archivo text-[14px] font-bold uppercase tracking-[0.1em] text-inkd transition-colors hover:bg-inkd hover:text-paper"
              >
                See real results
              </a>
            </div>
          </div>

          {/* Proof, framed like a document exhibit rather than a floating card */}
          <div className="lg:col-span-5">
            <figure className="border border-inkd bg-paper">
              <figcaption className="flex items-center justify-between gap-3 border-b border-inkd bg-inkd px-4 py-2.5">
                <span className="font-plex text-[10px] font-semibold uppercase tracking-[0.2em] text-paper/70">
                  Exhibit A — Google search
                </span>
                <span className="font-plex text-[10px] font-semibold text-brand">RANK 01</span>
              </figcaption>
              <picture>
                <source srcSet="/heroimage.webp" type="image/webp" />
                <img
                  src="/heroimage.png"
                  alt="Google search results showing Seven Stones Landscape ranked first for landscaping contractor near me"
                  className="block h-auto w-full"
                  fetchpriority="high"
                  loading="eager"
                  decoding="async"
                />
              </picture>
              <div className="flex items-center justify-between gap-3 border-t border-inkd px-4 py-2.5">
                <span className="font-archivo text-[13px] text-inkd2">Client result</span>
                <a
                  href="https://sevenstoneslandscape.ca" target="_blank" rel="noreferrer"
                  className="font-archivo text-[13px] font-semibold text-inkd underline decoration-brand decoration-2 underline-offset-2"
                >
                  Seven Stones Landscape
                </a>
              </div>
            </figure>
          </div>
        </div>

        {/* Hairline fact row */}
        <dl className="mt-14 grid border-t border-inkd md:grid-cols-3">
          {facts.map(([n, term, desc], i) => (
            <div key={n} className={`border-b border-paperEdge py-5 md:border-b-0 ${i > 0 ? 'md:border-l md:border-paperEdge md:pl-8' : 'md:pr-8'} ${i === 1 ? 'md:px-8' : ''}`}>
              <div className="flex gap-4">
                <span className="font-plex text-[11px] font-semibold text-brand">{n}</span>
                <div>
                  <dt className="font-archivo text-[16px] font-bold text-inkd">{term}</dt>
                  <dd className="mt-1 font-archivo text-[14.5px] leading-snug text-inkd3">{desc}</dd>
                </div>
              </div>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* ============================================================
   GUARANTEE
   ============================================================ */
function GuaranteeStamp({ className = '' }) {
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label="30-day guarantee: 3 bookings or you do not pay">
      <circle cx="100" cy="100" r="95" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="100" cy="100" r="83" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      <text x="100" y="56" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="8.5" fontWeight="700" letterSpacing="2.5" fill="currentColor">OR YOU DON'T PAY</text>
      <line x1="66" y1="66" x2="134" y2="66" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      <text x="100" y="118" textAnchor="middle" fontFamily="Archivo, sans-serif" fontSize="60" fontWeight="800" fill="currentColor">3</text>
      <text x="100" y="138" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="13" fontWeight="700" letterSpacing="4" fill="currentColor">BOOKINGS</text>
      <line x1="66" y1="150" x2="134" y2="150" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      <text x="100" y="166" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="8.5" fontWeight="700" letterSpacing="2" fill="currentColor">30-DAY GUARANTEE</text>
    </svg>
  );
}

function Guarantee() {
  const terms = [
    ['Month to month', 'No long contracts. Cancel any time.'],
    ['Tracking first', 'Call and form tracking before we spend a dollar.'],
    ['You set the bar', 'You approve what counts as a qualified booking.']
  ];
  return (
    <section className="grain relative overflow-hidden border-b border-inkd bg-inkd text-paper">
      <div className="h-[3px] w-full bg-brand" />
      <div className="relative mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-20">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-8">
            <div className="flex items-center gap-4">
              <Eyebrow>Our guarantee</Eyebrow>
              <span className="h-px w-20 bg-paper/20" />
            </div>

            <h2 className="mt-6 font-archivo text-[2.4rem] font-extrabold leading-[0.98] tracking-[-0.03em] sm:text-5xl lg:text-[3.9rem]">
              Three qualified bookings in your first thirty days.{' '}
              <span className="text-brand">Or you do not pay.</span>
            </h2>

            <dl className="mt-10 grid border-y border-paper/15 sm:grid-cols-3">
              {terms.map(([term, desc], i) => (
                <div key={term} className={`border-b border-paper/15 py-5 sm:border-b-0 ${i > 0 ? 'sm:border-l sm:border-paper/15 sm:pl-6' : 'sm:pr-6'} ${i === 1 ? 'sm:px-6' : ''}`}>
                  <dt className="font-archivo text-[15px] font-bold text-brand">{term}</dt>
                  <dd className="mt-1.5 font-archivo text-[14.5px] leading-snug text-paper/65">{desc}</dd>
                </div>
              ))}
            </dl>

            <p className="mt-6 max-w-xl font-archivo text-[13.5px] leading-relaxed text-paper/50">
              Full terms, including the definition of a qualified booking, are set out in your service agreement.
            </p>
          </div>

          <div className="lg:col-span-4 lg:border-l lg:border-paper/15 lg:pl-12">
            <div className="flex flex-col items-start gap-8">
              <GuaranteeStamp className="h-36 w-36 -rotate-6 text-brand" />
              <div className="w-full">
                <a
                  href="/apply"
                  className="group flex w-full items-center justify-center gap-2.5 bg-brand px-7 py-4 font-archivo text-[14px] font-bold uppercase tracking-[0.1em] text-paper transition-colors hover:bg-paper hover:text-inkd"
                >
                  Claim your guarantee
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </a>
                <p className="mt-3 font-archivo text-[13px] text-paper/50">
                  Starts with a free audit. No obligation, no pressure.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   INDUSTRIES
   ============================================================ */
function Industries() {
  const trades = ['Concrete', 'Roofing', 'Landscaping', 'Plumbing', 'HVAC', 'Electrical',
    'Renovation', 'Paving', 'Builders', 'Excavation', 'Painting', 'Decking'];
  return (
    <section className="border-b border-inkd bg-paper2">
      <div className="mx-auto max-w-6xl px-5 py-12 md:px-8">
        <div className="flex items-center gap-4">
          <Eyebrow>Trades we work with</Eyebrow>
          <span className="h-px flex-1 bg-paperEdge" />
        </div>
        <ul className="mt-6 grid grid-cols-2 border-t border-paperEdge sm:grid-cols-3 lg:grid-cols-6">
          {trades.map((t, i) => (
            <li
              key={t}
              className={`border-b border-paperEdge py-3.5 font-archivo text-[15px] font-semibold text-inkd
                ${(i + 1) % 2 !== 0 ? 'pr-4 sm:pr-0' : 'pl-4 sm:pl-0'}
                sm:border-l sm:border-paperEdge sm:pl-4 ${i % 3 === 0 ? 'sm:border-l-0 sm:pl-0' : ''}
                lg:border-l lg:pl-4 ${i % 6 === 0 ? 'lg:border-l-0 lg:pl-0' : ''}`}
            >
              <span className="mr-2 text-brand">/</span>{t}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ============================================================
   BEFORE / AFTER — WEBSITE SLIDER
   ============================================================ */
function WebsiteBeforeAfter() {
  const [pos, setPos] = useState(50);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });

  useEffect(() => {
    if (!inView) return;
    let frame;
    const start = performance.now();
    const tick = (t) => {
      const elapsed = (t - start) / 1000;
      // Auto-sweep once so people notice it is draggable: 50 -> 15 -> 85 -> 50
      setPos(Math.sin(elapsed * 0.9) * 35 + 50);
      if (elapsed < 5) frame = requestAnimationFrame(tick);
      else setPos(50);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView]);

  return (
    <div ref={ref} className="border border-inkd bg-paper">
      <div className="flex items-center justify-between gap-3 border-b border-inkd bg-inkd px-4 py-2.5">
        <span className="font-plex text-[10px] font-semibold uppercase tracking-[0.2em] text-paper/70">
          sevenstoneslandscape.ca
        </span>
        <span className="font-archivo text-[12.5px] text-paper/50">Drag to compare</span>
      </div>

      <div
        role="img"
        aria-label="Before and after comparison of a contractor website. Drag horizontally to compare."
        className="relative aspect-[16/10] cursor-ew-resize select-none bg-paper"
        style={{ touchAction: 'pan-y' }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setPos(((e.clientX - rect.left) / rect.width) * 100);
        }}
        onTouchMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const t = e.touches[0];
          setPos(Math.max(0, Math.min(100, ((t.clientX - rect.left) / rect.width) * 100)));
        }}
      >
        <picture>
          <source srcSet="/slider2.webp" type="image/webp" />
          <img src="/slider2.png" alt="Modern, high-converting contractor website, after"
            className="absolute inset-0 h-full w-full object-cover object-top" loading="lazy" />
        </picture>

        <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          <picture>
            <source srcSet="/slider1.webp" type="image/webp" />
            <img src="/slider1.png" alt="Outdated contractor website, before"
              className="absolute inset-0 h-full w-full object-cover object-top" loading="lazy" />
          </picture>
        </div>

        <div className="pointer-events-none absolute bottom-0 top-0 w-[3px] bg-brand" style={{ left: `${pos}%` }}>
          <div className="absolute top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-0.5 bg-brand text-paper">
            <ArrowLeft className="h-3.5 w-3.5" />
            <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </div>

        <span className="absolute left-3 top-3 bg-inkd px-2 py-1 font-plex text-[10px] font-bold uppercase tracking-[0.16em] text-paper">Before</span>
        <span className="absolute right-3 top-3 bg-brand px-2 py-1 font-plex text-[10px] font-bold uppercase tracking-[0.16em] text-paper">After</span>
      </div>
    </div>
  );
}

/* ============================================================
   BEFORE / AFTER — GOOGLE BUSINESS PROFILE
   ============================================================ */
function ExhibitPanel({ tag, status, statusTone, img, webp, alt, points, accent = false }) {
  return (
    <motion.figure
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5 }}
      className={`border bg-paper ${accent ? 'border-brand' : 'border-inkd'}`}
    >
      {accent && <div className="h-[3px] bg-brand" />}
      <figcaption className={`flex items-center justify-between gap-3 border-b px-4 py-2.5 ${accent ? 'border-brand bg-brand' : 'border-inkd bg-inkd'}`}>
        <span className="font-plex text-[10px] font-semibold uppercase tracking-[0.2em] text-paper">{tag}</span>
        <span className={`font-plex text-[10px] font-semibold ${statusTone}`}>{status}</span>
      </figcaption>
      <picture>
        <source srcSet={webp} type="image/webp" />
        <img src={img} alt={alt} className="block h-auto w-full" loading="lazy" />
      </picture>
      {points && (
        <ul className="border-t border-paperEdge">
          {points.map(([ok, text]) => (
            <li key={text} className="flex items-start gap-3 border-b border-paperEdge px-4 py-3 last:border-b-0">
              <span className={`mt-0.5 font-plex text-[11px] font-bold ${ok ? 'text-brand' : 'text-inkd3'}`}>
                {ok ? '+' : '−'}
              </span>
              <span className="font-archivo text-[14.5px] leading-snug text-inkd2">{text}</span>
            </li>
          ))}
        </ul>
      )}
    </motion.figure>
  );
}

function GBPBeforeAfter() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:gap-8">
      <ExhibitPanel
        tag="Before" status="PAGE 2" statusTone="text-paper/60"
        img="/gbpbefore.png" webp="/gbpbefore.webp"
        alt="Google search before: Seven Stones Landscape with low visibility, no photos, only 9 reviews"
        points={[
          [false, 'No photos uploaded'],
          [false, 'Hours and service area missing'],
          [false, '9 reviews at a 3.4 rating'],
          [false, 'Buried below the local map pack']
        ]}
      />
      <ExhibitPanel
        accent
        tag="After" status="MAP PACK 01" statusTone="text-paper"
        img="/gbpafter.png" webp="/gbpafter.webp"
        alt="Google search after: Seven Stones Landscape ranked first in the map pack with 247 reviews and 80+ photos"
        points={[
          [true, 'Over 80 professional photos uploaded'],
          [true, 'Live hours, services, and offers'],
          [true, '247 reviews at a 5.0 rating'],
          [true, 'Ranks first in the local map pack']
        ]}
      />
    </div>
  );
}

function AdsBeforeAfter() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:gap-8">
      <ExhibitPanel
        tag="Before" status="POSITION 4" statusTone="text-paper/60"
        img="/googlebefore.png" webp="/googlebefore.webp"
        alt="Google Ads before: stuck at position 4, $92 per lead, 1.1 percent click-through rate"
      />
      <ExhibitPanel
        accent
        tag="After" status="TOP OF PAGE" statusTone="text-paper"
        img="/googleafter.png" webp="/googleafter.webp"
        alt="Google Ads after: top of page at position 1, $26 per lead, 7.8 percent click-through rate"
      />
    </div>
  );
}

/* ============================================================
   RESULTS
   ============================================================ */
function Exhibit({ n, label, title, sub, children }) {
  return (
    <div className="border-t border-inkd pt-8">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-baseline sm:gap-8">
        <div className="flex shrink-0 items-baseline gap-3">
          <span className="font-archivo text-[38px] font-extrabold leading-none tracking-[-0.04em] text-paperEdge">{n}</span>
          <span className="font-plex text-[10px] font-semibold uppercase tracking-[0.2em] text-brand">{label}</span>
        </div>
        <div>
          <h3 className="font-archivo text-[22px] font-extrabold leading-[1.15] tracking-[-0.02em] text-inkd sm:text-[26px]">
            {title}
          </h3>
          <p className="mt-2 max-w-2xl font-archivo text-[15.5px] leading-[1.6] text-inkd2">{sub}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function Results() {
  return (
    <section id="results" className="border-b border-inkd bg-paper scroll-mt-20">
      <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-20">
        <SectionHead
          kicker="Real transformations"
          title="Three things every contractor needs working together"
          sub="Your website, your Google Business Profile, and your Google Ads. Fix one and you get a bump. Fix all three and the phone changes character."
        />

        <div className="mt-14 space-y-16">
          <Exhibit
            n="01" label="Website"
            title="From a site nobody trusts to a page built to book estimates"
            sub="Drag the slider to compare. It sweeps once on its own the first time you scroll past."
          >
            <WebsiteBeforeAfter />
          </Exhibit>

          <Exhibit
            n="02" label="Google Business Profile"
            title="From buried on page two to owning the local map pack"
            sub="More photos, more reviews, correct categories. All the things competitors leave half done."
          >
            <GBPBeforeAfter />
          </Exhibit>

          <Exhibit
            n="03" label="Google Ads"
            title="From wasted spend at position four to top of page for less"
            sub="Better quality score, better ad copy, better targeting, built around homeowners who actually buy."
          >
            <AdsBeforeAfter />
          </Exhibit>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   NUMBERS
   ============================================================ */
function Numbers() {
  const stats = [
    { to: 312, suffix: '%',     label: 'Lead growth in one case study' },
    { to: 47,  suffix: '%',     label: 'Lower cost per lead' },
    { to: 4.8, suffix: 'x',     label: 'Site conversion lift', decimals: 1 },
    { to: 90,  suffix: ' days', label: 'Typical time to traction' }
  ];
  return (
    <section className="grain relative overflow-hidden border-b border-inkd bg-inkd text-paper">
      <div className="relative mx-auto max-w-6xl px-5 py-14 md:px-8 md:py-16">
        <div className="flex items-center gap-4">
          <Eyebrow>From a real contractor campaign</Eyebrow>
          <span className="h-px flex-1 bg-paper/20" />
        </div>

        <dl className="mt-10 grid grid-cols-2 border-t border-paper/15 lg:grid-cols-4">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={`border-b border-paper/15 py-7 ${i % 2 === 1 ? 'border-l border-paper/15 pl-6' : 'pr-6'}
                lg:border-b-0 lg:pl-6 ${i === 0 ? 'lg:border-l-0 lg:pl-0' : 'lg:border-l lg:border-paper/15'}`}
            >
              <dd className="font-archivo text-[40px] font-extrabold leading-none tracking-[-0.04em] text-brand sm:text-[52px]">
                <Counter to={s.to} suffix={s.suffix} decimals={s.decimals || 0} />
              </dd>
              <dt className="mt-2.5 max-w-[16ch] font-archivo text-[14.5px] leading-snug text-paper/60">{s.label}</dt>
            </div>
          ))}
        </dl>

        <p className="mt-8 max-w-3xl font-archivo text-[13.5px] leading-[1.7] text-paper/50">
          These figures come from specific past contractor campaigns and are not a prediction of your results.
          What is realistic for your business depends on your market, budget, service area, seasonality, and
          your own sales process. Ask us and we will tell you straight.
        </p>
      </div>
    </section>
  );
}

/* ============================================================
   TESTIMONIALS
   ============================================================ */
function Testimonials() {
  const items = [
    {
      quote: 'Trade Leads Marketing rebuilt our landing page, cleaned up our Google Business Profile, and our quote requests jumped within weeks. We can finally see exactly which jobs came from which campaign.',
      name: 'John Scime', role: 'Owner, Seven Stones Landscape',
      where: 'sevenstoneslandscape.ca', site: 'https://sevenstoneslandscape.ca'
    },
    {
      quote: 'These guys actually understand contractors. Our Google Ads were bleeding money before. Now we are booking high-ticket HVAC jobs at a fraction of the cost per lead. Straight shooters.',
      name: 'Saif Sabeeh', role: 'Owner, Ikad Mechanical HVAC',
      where: 'ikad.ca', site: 'https://ikad.ca/'
    },
    {
      quote: 'I was getting reports from my old agency that meant nothing. Trade Leads Marketing showed me the booked jobs and the revenue, not just clicks. The phone is ringing for the right kind of work now.',
      name: 'Danny', role: 'General Contractor',
      where: 'Renovations and custom builds'
    }
  ];

  return (
    <section className="border-b border-inkd bg-paper">
      <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-20">
        <SectionHead
          kicker="Contractor approved"
          title="What contractors say"
          sub="Real contractors, real campaigns. Reach out to any of them directly if you want to check."
        />

        <div className="mt-12 grid border-t border-inkd md:grid-cols-3">
          {items.map((t, i) => (
            <figure
              key={t.name}
              className={`flex flex-col justify-between border-b border-paperEdge py-8 md:border-b-0
                ${i > 0 ? 'md:border-l md:border-paperEdge md:pl-8' : 'md:pr-8'} ${i === 1 ? 'md:px-8' : ''}`}
            >
              <blockquote className="border-l-[3px] border-brand pl-5 font-archivo text-[16px] leading-[1.6] text-inkd">
                {t.quote}
              </blockquote>
              <figcaption className="mt-6 pl-5">
                <div className="font-archivo text-[15px] font-bold text-inkd">{t.name}</div>
                <div className="mt-0.5 font-archivo text-[13.5px] text-inkd3">{t.role}</div>
                {t.site ? (
                  <a href={t.site} target="_blank" rel="noreferrer"
                    className="mt-1 inline-block font-archivo text-[13.5px] text-inkd underline decoration-brand decoration-2 underline-offset-2">
                    {t.where}
                  </a>
                ) : (
                  <div className="mt-1 font-archivo text-[13.5px] text-inkd3">{t.where}</div>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   WHY US
   ============================================================ */
function WhyUs() {
  const points = [
    ['Built only for contractors', 'Not law firms, not e-commerce. Just trades, every day.'],
    ['We chase booked jobs', 'Calls, forms, estimates, and revenue. That is the scorecard.'],
    ['Buyer-intent landing pages', 'Pages written for homeowners who are ready to spend.'],
    ['Less wasted ad spend', 'Negative keywords, geo-targeting, and quality-score work.'],
    ['Local SEO that ranks', 'Service-area pages, citations, and review velocity.'],
    ['Tracking before launch', 'Calls, forms, conversions. Everything attributed.'],
    ['Reporting tied to revenue', 'No vanity metrics. Just the numbers that pay for trucks.']
  ];
  return (
    <section className="border-b border-inkd bg-paper2">
      <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-20">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-5">
            <SectionHead
              kicker="Why contractors switch"
              title="Impressions do not pour concrete"
              sub="Clicks do not replace a roof. We measure what puts trucks on driveways: qualified leads, booked estimates, and the data behind them. We do not guarantee specific results, but we do guarantee a real strategy, real tracking, and straight answers."
            />
            <a
              href="/apply"
              className="group mt-8 inline-flex items-center gap-2.5 bg-inkd px-7 py-4 font-archivo text-[14px] font-bold uppercase tracking-[0.1em] text-paper transition-colors hover:bg-brand"
            >
              Apply for a free audit
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
          </div>

          <ol className="lg:col-span-7">
            {points.map(([title, desc], i) => (
              <li key={title} className="flex gap-5 border-t border-paperEdge py-4 last:border-b">
                <span className="font-plex text-[11px] font-semibold tabular-nums text-brand">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3 className="font-archivo text-[16.5px] font-bold text-inkd">{title}</h3>
                  <p className="mt-1 font-archivo text-[14.5px] leading-snug text-inkd2">{desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   PROCESS
   ============================================================ */
function Process() {
  const steps = [
    ['01', 'Audit', 'We go through your website, ads, SEO, competitors, and tracking. No fluff.'],
    ['02', 'Build', 'We create or rebuild the pages, campaigns, and local SEO foundation.'],
    ['03', 'Launch', 'We go live and optimize for real quote requests, not vanity clicks.'],
    ['04', 'Track', 'We track calls, forms, lead quality, booked estimates, and sold jobs.'],
    ['05', 'Improve', 'We keep improving on actual data, not guesses or gut feel.']
  ];
  return (
    <section id="process" className="grain relative overflow-hidden border-b border-inkd bg-inkd text-paper scroll-mt-20">
      <div className="relative mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-20">
        <SectionHead
          tone="paper"
          kicker="Our process"
          title="A simple system for more qualified leads"
          sub="Five steps. Every contractor we work with goes through them, and every step ties back to job revenue."
        />

        <div className="mt-14 grid border-t border-paper/15 sm:grid-cols-2 lg:grid-cols-5">
          {steps.map(([n, title, desc], i) => (
            <div
              key={n}
              className={`border-b border-paper/15 py-7 sm:border-b-0 lg:py-8
                ${i > 0 ? 'sm:border-l sm:border-paper/15 sm:pl-6' : 'sm:pr-6'}
                ${i % 2 === 0 ? 'sm:border-l-0 sm:pl-0 lg:border-l lg:pl-6' : ''}
                ${i === 0 ? 'lg:border-l-0 lg:pl-0' : ''}`}
            >
              <div className="font-archivo text-[40px] font-extrabold leading-none tracking-[-0.04em] text-paper/15">
                {n}
              </div>
              <h3 className="mt-4 font-archivo text-[18px] font-bold">{title}</h3>
              <p className="mt-2 font-archivo text-[14.5px] leading-[1.6] text-paper/60">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   FAQ
   ============================================================ */
function FAQ() {
  const faqs = [
    { q: 'Do you only work with contractors?', a: 'Yes. We work only with contractors and local trade businesses: landscaping, concrete, roofing, plumbing, electrical, HVAC, paving, builders, and renovation companies. That focus is why our campaigns convert.' },
    { q: 'How long does it take to see results?', a: "It depends on your market, budget, and starting point. We don't make blanket guarantees. In our experience, Google Ads can start producing qualified leads within the first one to two weeks once tracking is set up correctly. SEO and Google Business Profile improvements typically take 60 to 90 days or more to gain traction. We track everything from day one, so even when results take time to compound, you see exactly what is happening week by week." },
    { q: 'Do I need a new website?', a: 'Not always. We audit your current site first. If it converts, we leave it. If it leaks leads, we rebuild key pages or the whole site, whichever gets you the highest return fastest.' },
    { q: 'Do you manage Google Ads?', a: "Yes, and it's a core service. We structure campaigns by service type, exclude wasteful keywords, write contractor-specific ad copy, and tie every click back to booked jobs." },
    { q: 'Do you help with SEO and Google Business Profile?', a: 'Yes. Local SEO and Google Business Profile optimization are non-negotiable for contractors. We handle citations, review strategy, photos, posts, and on-page service content together.' },
    { q: 'Can you track calls and form submissions?', a: 'Always. We install call tracking, form tracking, and conversion tracking before we spend a dollar on ads. You will know exactly which campaign, ad, and keyword booked the job.' },
    { q: 'What makes you different from other marketing agencies?', a: "We only work with contractors. We focus on the metrics that map to booked jobs, not just clicks. And we give you straight answers about what's working and what isn't, without pretty reports that hide bad performance. No six-month lock-ins, no jargon, no inflated promises." }
  ];
  const [open, setOpen] = useState(0);

  return (
    <section id="faq" className="border-b border-inkd bg-paper scroll-mt-20">
      <div className="mx-auto max-w-4xl px-5 py-16 md:px-8 md:py-20">
        <SectionHead kicker="Straight answers" title="Questions contractors actually ask" />

        <div className="mt-12 border-t border-inkd">
          {faqs.map((f, i) => (
            <div key={f.q} className="border-b border-paperEdge">
              <button
                type="button"
                onClick={() => setOpen(open === i ? -1 : i)}
                aria-expanded={open === i}
                className="flex w-full items-start justify-between gap-6 py-5 text-left"
              >
                <span className="flex gap-4">
                  <span className="mt-1 font-plex text-[11px] font-semibold tabular-nums text-brand">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="font-archivo text-[17px] font-semibold leading-snug text-inkd">{f.q}</span>
                </span>
                <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border transition-all duration-300
                  ${open === i ? 'rotate-45 border-brand bg-brand text-paper' : 'border-paperEdge text-inkd3'}`}>
                  <Plus className="h-4 w-4" />
                </span>
              </button>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.28 }}
                    className="overflow-hidden"
                  >
                    <p className="max-w-2xl pb-6 pl-9 font-archivo text-[15.5px] leading-[1.7] text-inkd2">{f.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   AUDIT FORM
   ============================================================ */
function AuditField({ label, hint, id, error, children }) {
  return (
    <div>
      <label htmlFor={id} className="flex items-baseline justify-between gap-3">
        <span className="font-archivo text-[13.5px] font-semibold text-inkd2">{label}</span>
        {hint && <span className="font-archivo text-[12.5px] text-inkd3">{hint}</span>}
      </label>
      <div className="mt-1.5">{children}</div>
      {error && <p className="mt-1.5 font-archivo text-[13px] text-gRed">{error}</p>}
    </div>
  );
}

const inputCx = (error) =>
  `w-full border-0 border-b bg-transparent px-0 pb-2 pt-1 font-archivo text-[16px] text-inkd
   placeholder:text-inkd3/55 transition-colors focus:border-brand focus:outline-none focus:ring-0
   ${error ? 'border-gRed' : 'border-inkd/25'}`;

function AuditForm() {
  const [data, setData] = useState({
    name: '', business: '', email: '', phone: '', city: '', service: '', message: '', website: ''
  });
  const [status, setStatus] = useState({ state: 'idle', error: null });

  const update = (k) => (e) => setData({ ...data, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (data.website) return; // honeypot
    if (!data.name.trim() || !data.email.trim() || !data.city.trim()) {
      setStatus({ state: 'error', error: 'Please add your name, email, and city.' });
      return;
    }
    setStatus({ state: 'sending', error: null });
    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Submission failed. Please email info@tradeleadsmarketing.com directly.');
      }
      setStatus({ state: 'sent', error: null });
      setData({ name: '', business: '', email: '', phone: '', city: '', service: '', message: '', website: '' });
    } catch (err) {
      setStatus({ state: 'error', error: err.message });
    }
  };

  const services = [
    'Not sure yet, just exploring',
    'Google Ads management',
    'Website design or rebuild',
    'Local SEO',
    'Google Business Profile',
    'Lead tracking setup',
    'Full audit and strategy'
  ];

  return (
    <section id="audit" className="border-b border-inkd bg-paper2 scroll-mt-20">
      <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-20">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-5">
            <SectionHead
              kicker="Get your free audit"
              title="Tell us about your business"
              sub="Send this and we will review your website, Google Business Profile, ad presence, and tracking. Then we will walk you through what is helping, what is wasting money, and what to fix first. No obligation."
            />

            <dl className="mt-9 border-t border-paperEdge">
              {[
                ['Call or text', PHONE_DISPLAY, PHONE_HREF],
                ['Email', EMAIL, `mailto:${EMAIL}`],
                ['Reply time', 'Same day during business hours', null],
                ['Your details', 'Never sold, never shared', null]
              ].map(([k, v, href]) => (
                <div key={k} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-paperEdge py-3.5">
                  <dt className="font-archivo text-[13.5px] text-inkd3">{k}</dt>
                  <dd className="font-archivo text-[15px] font-semibold text-inkd">
                    {href ? (
                      <a href={href} className="underline decoration-brand decoration-2 underline-offset-2 hover:text-brand">{v}</a>
                    ) : v}
                  </dd>
                </div>
              ))}
            </dl>

            <p className="mt-6 max-w-md font-archivo text-[14.5px] leading-[1.65] text-inkd2">
              Want the longer version? The{' '}
              <a href="/apply" className="font-semibold text-inkd underline decoration-brand decoration-2 underline-offset-2">
                application form
              </a>{' '}
              takes about thirty seconds and tells us more up front.
            </p>
          </div>

          <div className="lg:col-span-7">
            <div className="border border-inkd bg-paper">
              <div className="flex items-center justify-between gap-4 border-b border-inkd bg-inkd px-5 py-2.5">
                <span className="font-plex text-[10px] font-semibold uppercase tracking-[0.2em] text-paper/70">
                  Free audit request
                </span>
                <span className="font-plex text-[10px] font-semibold text-brand">NO COST</span>
              </div>

              <form onSubmit={submit} className="px-5 py-8 md:px-8">
                <input
                  type="text" name="website" tabIndex="-1" autoComplete="off" aria-hidden="true"
                  value={data.website} onChange={update('website')} className="hidden"
                />

                <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
                  <AuditField label="Your name" hint="Required" id="name">
                    <input id="name" type="text" required value={data.name} onChange={update('name')}
                      placeholder="John Smith" autoComplete="name" className={inputCx(false)} />
                  </AuditField>
                  <AuditField label="Business name" id="business">
                    <input id="business" type="text" value={data.business} onChange={update('business')}
                      placeholder="Smith Concrete Co." autoComplete="organization" className={inputCx(false)} />
                  </AuditField>
                  <AuditField label="Email" hint="Required" id="email">
                    <input id="email" type="email" required value={data.email} onChange={update('email')}
                      placeholder="you@yourcompany.com" autoComplete="email" className={inputCx(false)} />
                  </AuditField>
                  <AuditField label="Phone" id="phone">
                    <input id="phone" type="tel" value={data.phone} onChange={update('phone')}
                      placeholder="(555) 123-4567" autoComplete="tel" className={inputCx(false)} />
                  </AuditField>
                </div>

                <div className="mt-6 grid gap-x-8 gap-y-6 sm:grid-cols-2">
                  <AuditField label="City or service area" hint="Required" id="city">
                    <input id="city" type="text" required value={data.city} onChange={update('city')}
                      placeholder="Hamilton, ON" autoComplete="address-level2" className={inputCx(false)} />
                  </AuditField>
                  <AuditField label="Most interested in" id="service">
                    <select id="service" value={data.service} onChange={update('service')} className={inputCx(false)}>
                      <option value="">Select an option</option>
                      {services.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </AuditField>
                </div>

                <div className="mt-6">
                  <AuditField label="Tell us a bit about your business" hint="Optional" id="message">
                    <textarea id="message" rows="3" value={data.message} onChange={update('message')}
                      placeholder="Trade, current marketing spend, biggest pain point" className={`${inputCx(false)} resize-none`} />
                  </AuditField>
                </div>

                {status.state === 'error' && (
                  <div className="mt-6 border-l-[3px] border-gRed bg-gRed/5 px-4 py-3 font-archivo text-[14px] text-inkd">
                    {status.error}
                  </div>
                )}
                {status.state === 'sent' && (
                  <div className="mt-6 border-l-[3px] border-brand bg-brand/5 px-4 py-3 font-archivo text-[14px] text-inkd">
                    <strong className="font-semibold">Thanks, we have it.</strong> We will reach out within one
                    business day.
                  </div>
                )}

                <div className="mt-8 flex flex-col items-start gap-4 border-t border-paperEdge pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <p className="max-w-xs font-archivo text-[13px] leading-relaxed text-inkd3">
                    By submitting you agree we may contact you about your audit.
                  </p>
                  <button
                    type="submit" disabled={status.state === 'sending'}
                    className="group inline-flex shrink-0 items-center gap-2.5 whitespace-nowrap bg-brand px-7 py-4 font-archivo text-[14px] font-bold uppercase tracking-[0.1em] text-paper transition-colors hover:bg-brandpress disabled:opacity-60"
                  >
                    {status.state === 'sending' ? 'Sending' : 'Get my free audit'}
                    {status.state !== 'sending' && (
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   FOOTER
   ============================================================ */
function Colophon() {
  return (
    <footer className="bg-inkd text-paper">
      <div className="mx-auto max-w-6xl px-5 py-14 md:px-8">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <a href="#top" className="flex items-center gap-4">
              <img src="/tlm-mark.png" alt="" className="h-14 w-14 object-contain" />
              <span className="leading-tight">
                <span className="block font-archivo text-[15px] font-extrabold uppercase tracking-[0.06em]">
                  Trade Leads Marketing
                </span>
                <span className="block font-archivo text-[12.5px] text-paper/45">tradeleadsmarketing.com</span>
              </span>
            </a>
            <p className="mt-6 max-w-sm font-archivo text-[15px] leading-[1.65] text-paper/65">
              Marketing for contractors who want more qualified leads, not prettier reports.
            </p>
            <a
              href="/apply"
              className="group mt-7 inline-flex items-center gap-2.5 bg-brand px-6 py-3.5 font-archivo text-[13px] font-bold uppercase tracking-[0.1em] text-paper transition-colors hover:bg-paper hover:text-inkd"
            >
              Apply for a free audit
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
          </div>

          <div className="md:col-span-3">
            <div className="font-plex text-[10px] font-semibold uppercase tracking-[0.22em] text-paper/40">Sitemap</div>
            <ul className="mt-4 space-y-2.5">
              {[['Results', '#results'], ['Process', '#process'], ['Questions', '#faq'],
                ['Apply', '/apply'], ['ROI calculator', '/calculator']].map(([l, h]) => (
                <li key={l}>
                  <a href={h} className="font-archivo text-[15px] text-paper/70 transition-colors hover:text-brand">{l}</a>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-4">
            <div className="font-plex text-[10px] font-semibold uppercase tracking-[0.22em] text-paper/40">Contact</div>
            <a href={PHONE_HREF} className="mt-4 block font-archivo text-[26px] font-extrabold tracking-[-0.02em] transition-colors hover:text-brand">
              {PHONE_DISPLAY}
            </a>
            <a href={`mailto:${EMAIL}`} className="mt-1.5 block break-all font-archivo text-[15px] text-paper/70 transition-colors hover:text-brand">
              {EMAIL}
            </a>
            <p className="mt-4 font-archivo text-[14px] text-paper/50">
              Serving contractors across North America.
            </p>
          </div>
        </div>

        <p className="mt-12 max-w-4xl border-t border-paper/15 pt-6 font-archivo text-[13.5px] leading-[1.75] text-paper/55">
          <span className="font-semibold text-paper/70">Disclaimer.</span> Except where an explicit written
          guarantee applies (such as our 30-day guarantee, which is subject to its own qualifying terms and the
          definition of a qualified booking agreed in your service agreement), Trade Leads Marketing does not
          guarantee specific lead volume, ranking position, or revenue outcomes. Results depend on factors
          including market competition, budget, service area, seasonality, and the contractor's own sales
          process. Examples and case studies on this site reflect outcomes from specific past campaigns and are
          not predictive of future performance. Google, Google Ads, and Google Business Profile are trademarks
          of Google LLC, used here descriptively; Trade Leads Marketing is not affiliated with or endorsed by
          Google.
        </p>

        <div className="mt-6 flex flex-col justify-between gap-2 border-t border-paper/15 pt-6 font-archivo text-[12.5px] text-paper/50 sm:flex-row">
          <span>© {new Date().getFullYear()} Trade Leads Marketing. All rights reserved.</span>
          <span>Built for contractors. Built to convert.</span>
        </div>
      </div>
    </footer>
  );
}

/* ============================================================
   PAGE
   ============================================================ */
export default function App() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-paper font-archivo text-inkd antialiased">
      <PageStyle />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:bg-brand focus:px-4 focus:py-2 focus:font-semibold focus:text-paper"
      >
        Skip to content
      </a>
      <Masthead />
      <main id="main">
        <Hero />
        <Guarantee />
        {/* Reviews sit directly under the guarantee: the promise lands harder
            when someone other than us backs it on the same screen. */}
        <Testimonials />
        <Industries />
        <Results />
        <Numbers />
        <WhyUs />
        <Process />
        <FAQ />
        <AuditForm />
      </main>
      <Colophon />
    </div>
  );
}
