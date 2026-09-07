import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Phone, ArrowRight, ArrowUpRight } from 'lucide-react';

/* ============================================================
   TRADE LEADS MARKETING — /thank-you

   Same industrial-utilitarian language as /apply: paper ground,
   warm ink, safety orange, hairline rules. Reads as a stamped
   receipt for the application just filed. One job — make calling
   us the easiest thing on the page.
   ============================================================ */

const PHONE_DISPLAY = '(289) 489-1167';
const PHONE_HREF    = 'tel:+12894891167';
const SMS_HREF      = 'sms:+12894891167';
const EMAIL         = 'info@tradeleadsmarketing.com';

/* Business hours in Eastern time, regardless of where the visitor is,
   because the office is in Ontario and the promise has to be true there. */
function replyWindow() {
  let hour, day;
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Toronto', hour: 'numeric', hour12: false, weekday: 'short'
    }).formatToParts(new Date());
    hour = Number(parts.find((p) => p.type === 'hour')?.value);
    day = parts.find((p) => p.type === 'weekday')?.value;
  } catch {
    const now = new Date();
    hour = now.getHours();
    day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][now.getDay()];
  }
  const weekday = !['Sat', 'Sun'].includes(day);
  if (weekday && hour >= 8 && hour < 17) return 'Someone is at a desk right now. Expect to hear back today.';
  if (weekday && hour < 8)               return 'We pick this up when the office opens this morning.';
  if (weekday)                           return 'We pick this up first thing tomorrow morning.';
  return 'We pick this up on the next business day.';
}

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
  `}</style>
);

function Masthead() {
  return (
    <header className="border-b border-inkd bg-paper">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3 md:px-8">
        <a href="/" className="flex items-center gap-4" aria-label="Trade Leads Marketing, home">
          <img src="/tlm-mark.png" alt="Trade Leads Marketing" className="h-14 w-14 object-contain md:h-16 md:w-16" />
          <span className="hidden h-10 w-px bg-paperEdge sm:block" />
          <span className="hidden leading-tight sm:block">
            <span className="block font-archivo text-[15px] font-extrabold uppercase tracking-[0.06em] text-inkd">
              Trade Leads Marketing
            </span>
            <span className="block font-plex text-[9.5px] uppercase tracking-[0.22em] text-inkd3">
              Lead generation for trades
            </span>
          </span>
        </a>
        <a href={PHONE_HREF} className="group flex items-center gap-2.5 border border-inkd px-4 py-2.5 transition-colors hover:bg-inkd">
          <Phone className="h-4 w-4 text-brandink" />
          <span className="hidden font-plex text-[12px] font-semibold tabular-nums text-inkd transition-colors group-hover:text-paper sm:block">
            {PHONE_DISPLAY}
          </span>
          <span className="font-plex text-[12px] font-semibold uppercase tracking-[0.1em] text-inkd transition-colors group-hover:text-paper sm:hidden">
            Call
          </span>
        </a>
      </div>
    </header>
  );
}

/* The stamp is the memorable mark on this page: a hand-set receipt block,
   rotated a couple of degrees like it was pressed by hand. */
function ReceivedStamp() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, rotate: -6 }}
      animate={{ opacity: 1, scale: 1, rotate: -3 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="inline-block border-[3px] border-brand px-5 py-2.5"
    >
      <span className="font-plex text-[13px] font-bold uppercase tracking-[0.3em] text-brand">
        Received
      </span>
    </motion.div>
  );
}

function Hero({ name, slot }) {
  return (
    <section className="grain relative overflow-hidden border-b border-inkd bg-inkd text-paper">
      <div className="relative mx-auto max-w-5xl px-5 py-16 md:px-8 md:py-20">
        <ReceivedStamp />

        <motion.h1
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.12 }}
          className="mt-8 max-w-3xl font-archivo text-[2.6rem] font-extrabold leading-[0.98] tracking-[-0.03em] sm:text-6xl"
        >
          {name ? `Thanks, ${name}.` : 'Thanks, we have it.'}
          <br />
          <span className="text-brand">{slot ? 'You are booked in.' : 'Your call is booked.'}</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-6 max-w-xl font-archivo text-[16.5px] leading-[1.65] text-paper/70"
        >
          {slot
            ? `We will call you on ${slot}. A calendar invite is already in your inbox.`
            : `A person handles this, not an autoresponder. ${replyWindow()}`}
        </motion.p>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-[3px] bg-brand" />
    </section>
  );
}

/* The one thing we want them to do next */
function CallBlock() {
  return (
    /* relative z-10 matters: the hero above is position:relative, so without a
       stacking bump it paints over this block's top edge and eats the strip. */
    <section className="relative z-10 mx-auto max-w-5xl px-5 md:px-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.28 }}
        className="-mt-10 border border-inkd bg-paper md:-mt-12"
      >
        <div className="flex items-center justify-between gap-4 border-b border-inkd bg-brandink px-5 py-2.5">
          <span className="font-plex text-[10px] font-semibold uppercase tracking-[0.22em] text-paper">
            Want to skip the queue
          </span>
          <span className="font-plex text-[10px] font-semibold tabular-nums text-paper/80">MON–FRI 08:00–17:00 ET</span>
        </div>

        <div className="px-5 py-8 md:px-9 md:py-10">
          <h2 className="max-w-2xl font-archivo text-[26px] font-extrabold leading-[1.08] tracking-[-0.02em] text-inkd sm:text-[34px]">
            Call now and we will book your audit call on the spot.
          </h2>
          <p className="mt-4 max-w-xl font-archivo text-[15px] leading-relaxed text-inkd2">
            Applications get worked in the order they arrive. A phone call jumps straight to the front, and it
            takes about two minutes to lock in a time that works around your job site.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href={PHONE_HREF}
              className="group inline-flex flex-1 items-center justify-center gap-3 bg-inkd px-8 py-5 transition-colors hover:bg-brand"
            >
              <Phone className="h-5 w-5 text-brandink transition-colors group-hover:text-paper" />
              <span className="font-plex text-[17px] font-semibold tabular-nums text-paper">{PHONE_DISPLAY}</span>
            </a>
            <a
              href={SMS_HREF}
              className="inline-flex items-center justify-center gap-2.5 border border-inkd px-8 py-5 font-archivo text-[14px] font-bold uppercase tracking-[0.1em] text-inkd transition-colors hover:bg-inkd hover:text-paper"
            >
              Text instead
            </a>
          </div>

          <dl className="mt-8 grid border-t border-paperEdge sm:grid-cols-3">
            {[
              ['Who answers', 'An owner, not a rep'],
              ['On the call', 'No pitch deck, no pressure'],
              ['The audit', 'Yours to keep either way']
            ].map(([k, v], i) => (
              <div key={k} className={`border-b border-paperEdge py-4 sm:border-b-0 ${i > 0 ? 'sm:border-l sm:border-paperEdge sm:pl-6' : 'sm:pr-6'}`}>
                <dt className="font-plex text-[9.5px] uppercase tracking-[0.18em] text-inkd3">{k}</dt>
                <dd className="mt-1.5 font-archivo text-[14px] font-semibold text-inkd">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </motion.div>
    </section>
  );
}

function Timeline({ booked }) {
  const steps = [
    ['01', booked ? 'Time booked' : 'We have your details',
      'Done. Nothing more you need to do right now.', 'Complete'],
    ['02', 'We do the homework',
      'Before we speak we go through your website, your Google Business Profile, your ads, and the competitors beating you in the map pack.',
      'Before the call'],
    ['03', 'We walk you through it',
      'Thirty minutes on what we found. You keep everything either way, even if we never work together.',
      booked ? 'At your booked time' : 'On your schedule']
  ];
  return (
    <section className="mx-auto max-w-5xl px-5 py-16 md:px-8 md:py-20">
      <div className="flex items-baseline gap-4">
        <h2 className="font-archivo text-[26px] font-extrabold tracking-[-0.02em] text-inkd sm:text-[32px]">
          What happens next
        </h2>
        <span className="hidden h-px flex-1 bg-paperEdge sm:block" />
      </div>

      <ol className="mt-9">
        {steps.map(([n, title, body, tag], i) => (
          <li key={n} className={`grid gap-x-6 gap-y-2 border-t border-inkd py-6 sm:grid-cols-[auto_1fr_auto] ${i === steps.length - 1 ? 'border-b' : ''}`}>
            <span className={`font-archivo text-[30px] font-extrabold leading-none tracking-[-0.04em] ${i === 0 ? 'text-brandink' : 'text-paperEdge'}`}>
              {n}
            </span>
            <div>
              <h3 className="font-archivo text-[18px] font-bold text-inkd">{title}</h3>
              <p className="mt-1.5 max-w-xl font-archivo text-[14.5px] leading-relaxed text-inkd2">{body}</p>
            </div>
            <span className={`self-start whitespace-nowrap font-plex text-[9.5px] font-semibold uppercase tracking-[0.16em] sm:text-right
              ${i === 0 ? 'text-brandink' : 'text-inkd3'}`}>
              {tag}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Prep() {
  const items = [
    'Roughly what a typical job is worth to you',
    'What you spend on marketing today, if anything',
    'Which services you actually want more of',
    'The jobs you would rather stop taking'
  ];
  return (
    <section className="border-t border-inkd bg-paper2">
      <div className="mx-auto grid max-w-5xl gap-10 px-5 py-16 md:grid-cols-2 md:px-8 md:py-20">
        <div>
          <div className="font-plex text-[9.5px] font-semibold uppercase tracking-[0.24em] text-brandink">
            Two minutes of prep
          </div>
          <h2 className="mt-4 font-archivo text-[26px] font-extrabold leading-[1.1] tracking-[-0.02em] text-inkd sm:text-[32px]">
            Have these handy for the call
          </h2>
          <p className="mt-4 max-w-sm font-archivo text-[15px] leading-relaxed text-inkd2">
            Nothing formal, ballpark numbers are fine. It just means we spend the call on your plan instead of
            on discovery questions.
          </p>
        </div>
        <ol>
          {items.map((x, i) => (
            <li key={x} className="flex gap-5 border-t border-paperEdge py-4 last:border-b">
              <span className="font-plex text-[10px] font-semibold tabular-nums text-brandink">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="font-archivo text-[14.5px] leading-snug text-inkd">{x}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Meanwhile() {
  return (
    <section className="border-t border-inkd">
      <div className="mx-auto max-w-5xl px-5 py-14 md:px-8">
        <div className="font-plex text-[9.5px] font-semibold uppercase tracking-[0.24em] text-inkd3">
          While you wait
        </div>
        <div className="mt-6 grid border-t border-inkd sm:grid-cols-2">
          <a href="/calculator" className="group border-b border-paperEdge py-6 transition-colors hover:bg-paper2 sm:border-b-0 sm:border-r sm:border-paperEdge sm:pr-8">
            <div className="flex items-start justify-between gap-4">
              <h3 className="font-archivo text-[19px] font-bold text-inkd">Run the ROI calculator</h3>
              <ArrowUpRight className="h-5 w-5 shrink-0 text-inkd3 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brandink" />
            </div>
            <p className="mt-2 max-w-sm font-archivo text-[14px] leading-relaxed text-inkd2">
              See what a given budget could turn into in leads, booked jobs, and revenue.
            </p>
          </a>

          <div className="border-b border-paperEdge py-6 sm:border-b-0 sm:pl-8">
            <blockquote className="border-l-[3px] border-brand pl-4 font-archivo text-[14.5px] italic leading-relaxed text-inkd">
              Our quote requests jumped within weeks. We can finally see exactly which jobs came from which
              campaign.
            </blockquote>
            <div className="mt-3 pl-4 font-plex text-[9.5px] uppercase leading-relaxed tracking-[0.14em] text-inkd3">
              John Scime
              <br />
              <a href="https://sevenstoneslandscape.ca" target="_blank" rel="noreferrer" className="text-inkd underline decoration-brand decoration-2 underline-offset-2">
                Seven Stones Landscape
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Colophon() {
  return (
    <footer className="border-t border-inkd bg-inkd text-paper">
      <div className="mx-auto max-w-5xl px-5 py-10 md:px-8">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <a href="/" className="flex items-center gap-4">
            <img src="/tlm-mark.png" alt="" className="h-12 w-12 object-contain" />
            <span className="leading-tight">
              <span className="block font-archivo text-[13px] font-extrabold uppercase tracking-[0.06em]">
                Trade Leads Marketing
              </span>
              <span className="block font-plex text-[9.5px] uppercase tracking-[0.2em] text-paper/40">
                tradeleadsmarketing.com
              </span>
            </span>
          </a>
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 font-plex text-[11px] uppercase tracking-[0.12em] [&>a]:py-1.5">
            <a href={PHONE_HREF} className="tabular-nums text-paper/75 transition-colors hover:text-brand">{PHONE_DISPLAY}</a>
            <a href={`mailto:${EMAIL}`} className="text-paper/75 transition-colors hover:text-brand">Email</a>
            <a href="/" className="inline-flex items-center gap-1.5 text-paper/75 transition-colors hover:text-brand">
              Back to site <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </nav>
        </div>
        <p className="mt-8 border-t border-paper/15 pt-6 font-plex text-[9.5px] uppercase tracking-[0.14em] text-paper/50">
          © {new Date().getFullYear()} Trade Leads Marketing
        </p>
      </div>
    </footer>
  );
}

function StickyCall() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-inkd bg-paper px-4 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] sm:hidden">
      <a href={PHONE_HREF} className="flex w-full items-center justify-center gap-3 bg-brandink px-5 py-3.5">
        <Phone className="h-4 w-4 text-paper" />
        <span className="font-plex text-[15px] font-semibold tabular-nums text-paper">{PHONE_DISPLAY}</span>
      </a>
    </div>
  );
}

export default function ThankYou() {
  const [name, setName] = useState('');
  const [slot, setSlot] = useState('');

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);

      // Calendly appends invitee_full_name and event_start_time to the redirect
      // when "Pass event details to your redirected page" is switched on. The
      // page still reads correctly when they are absent.
      const raw = q.get('invitee_full_name') || q.get('name') || '';
      const first = raw.trim().split(/\s+/)[0] || '';
      setName(first.replace(/[^\p{L}\p{M}'\- ]/gu, '').slice(0, 24));

      const start = q.get('event_start_time');
      if (start) {
        const d = new Date(start);
        if (!Number.isNaN(d.getTime())) {
          setSlot(new Intl.DateTimeFormat('en-CA', {
            weekday: 'long', month: 'long', day: 'numeric',
            hour: 'numeric', minute: '2-digit'
          }).format(d));
        }
      }
    } catch { /* no query string — generic greeting */ }
  }, []);

  return (
    <div className="min-h-screen bg-paper pb-20 font-archivo text-inkd antialiased sm:pb-0">
      <PageStyle />
      <Masthead />
      <main>
        <Hero name={name} slot={slot} />
        <CallBlock />
        <Timeline booked={Boolean(slot)} />
        <Prep />
        <Meanwhile />
      </main>
      <Colophon />
      <StickyCall />
    </div>
  );
}
