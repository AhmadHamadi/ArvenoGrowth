import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Check, CheckCircle2, Phone, Mail, Clock, ArrowRight, ArrowLeft,
  ClipboardList, PhoneCall, Send, ShieldCheck, Star, Globe, Calculator
} from 'lucide-react';

/* ============================================================
   TRADE LEADS MARKETING — /thank-you
   Landed on after a successful /apply submission. One job: make
   the next step obvious, and make calling us the easiest thing
   on the page.
   ============================================================ */

const PHONE_DISPLAY = '(289) 489-1167';
const PHONE_HREF    = 'tel:+12894891167';
const SMS_HREF      = 'sms:+12894891167';
const EMAIL         = 'info@tradeleadsmarketing.com';

/* Business hours, Eastern — used only to set expectations honestly */
function replyWindow() {
  const now = new Date();
  const day = now.getDay();          // 0 Sun … 6 Sat
  const hour = now.getHours();
  const weekday = day >= 1 && day <= 5;
  if (weekday && hour >= 8 && hour < 17) return 'Someone is at a desk right now — expect a reply today.';
  if (weekday && hour < 8)               return "We'll pick this up when the office opens this morning.";
  if (weekday)                           return "We'll pick this up first thing tomorrow morning.";
  return "We'll pick this up on the next business day.";
}

function Header() {
  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto max-w-5xl px-5 md:px-8 flex items-center justify-between py-3">
        <a href="/" className="flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-xl bg-white border border-line flex items-center justify-center shadow-soft p-1">
            <img src="/tlmlogo.png" alt="" className="h-full w-full object-contain" />
          </div>
          <div className="leading-tight">
            <div className="font-extrabold tracking-tight text-ink text-[15px]">Trade Leads</div>
            <div className="text-[9px] uppercase tracking-[0.25em] text-brand font-bold -mt-0.5">Marketing</div>
          </div>
        </a>
        <a href={PHONE_HREF} className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-3.5 py-2 text-sm font-bold text-ink hover:border-blue/40 hover:text-blue transition-colors">
          <Phone className="h-4 w-4 text-brand" />
          <span className="hidden sm:inline">{PHONE_DISPLAY}</span>
          <span className="sm:hidden">Call</span>
        </a>
      </div>
    </header>
  );
}

/* A tick that draws itself in — small reward for finishing the form */
function SuccessMark() {
  return (
    <motion.div
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative mx-auto h-20 w-20"
    >
      <span className="absolute inset-0 rounded-full bg-gGreen/15 animate-pulseGlow" />
      <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gGreen/10 border-2 border-gGreen/30">
        <svg viewBox="0 0 52 52" className="h-10 w-10">
          <motion.path
            d="M14 27 L23 35 L39 18"
            fill="none" stroke="#34A853" strokeWidth="5"
            strokeLinecap="round" strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, delay: 0.25, ease: 'easeOut' }}
          />
        </svg>
      </span>
    </motion.div>
  );
}

function Hero({ name }) {
  return (
    <section className="relative bg-white pt-12 md:pt-16 pb-10 overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-40" />
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-[360px] w-[600px] rounded-full bg-gGreen/10 blur-[120px]" />

      <div className="relative mx-auto max-w-3xl px-5 md:px-8 text-center">
        <SuccessMark />

        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }}
        >
          <div className="mt-6 eyebrow-light mx-auto">
            <span className="h-1.5 w-1.5 rounded-full bg-gGreen" />
            Application received
          </div>

          <h1 className="h-display text-4xl md:text-5xl text-ink mt-5">
            {name ? `Thanks, ${name}.` : 'Thanks — we got it.'}<br />
            <span className="text-blue">Your audit is being built.</span>
          </h1>

          <p className="mt-5 text-lg text-slate1 leading-relaxed max-w-xl mx-auto">
            A real person is reading your answers, not an autoresponder. {replyWindow()}
          </p>
        </motion.div>
      </div>
    </section>
  );
}

/* The one thing we want them to do next */
function CallCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.25 }}
      className="mx-auto max-w-3xl px-5 md:px-8"
    >
      <div className="rounded-2xl bg-[#0A0B0D] text-white overflow-hidden shadow-lifted">
        <div className="h-[3px] w-full bg-brand" />
        <div className="p-6 md:p-8">
          <div className="font-mono text-[11px] tracking-[0.3em] text-brand uppercase">
            Want to skip the queue?
          </div>
          <h2 className="mt-3 font-display font-extrabold text-2xl md:text-[2rem] leading-tight">
            Call us now and we'll book your audit call on the spot.
          </h2>
          <p className="mt-3 text-white/60 leading-relaxed">
            Applications get answered in order. A phone call jumps straight to the front — it takes about
            two minutes to lock in a time that works around your job site.
          </p>

          <div className="mt-7 flex flex-col sm:flex-row gap-3">
            <a href={PHONE_HREF} className="btn-primary text-base py-4 px-7 flex-1 animate-pulseGlow">
              <Phone className="h-5 w-5" /> Call {PHONE_DISPLAY}
            </a>
            <a href={SMS_HREF} className="btn-ghost-dark text-base py-4 px-7 flex-1">
              <Send className="h-4 w-4" /> Text us instead
            </a>
          </div>

          <div className="mt-5 pt-5 border-t border-white/10 grid sm:grid-cols-3 gap-4">
            {[
              { icon: Clock,       t: 'Mon – Fri, 8am – 5pm ET' },
              { icon: PhoneCall,   t: 'You get an owner, not a rep' },
              { icon: ShieldCheck, t: 'No pitch deck, no pressure' }
            ].map((x) => {
              const Icon = x.icon;
              return (
                <div key={x.t} className="flex items-center gap-2 text-[12px] text-white/55">
                  <Icon className="h-4 w-4 text-brand shrink-0" /> {x.t}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function NextSteps() {
  const steps = [
    { icon: Check,          t: 'Application received',   d: 'Done — nothing more you need to do right now.',            state: 'done' },
    { icon: ClipboardList,  t: 'We build your audit',    d: 'We go through your website, Google Business Profile, ads, and the competitors beating you in the map pack.', when: 'Within 1 business day' },
    { icon: PhoneCall,      t: 'We call you',            d: "A 15-minute walkthrough of what we found. You keep the audit either way — even if we never work together.", when: 'On your schedule' }
  ];
  return (
    <section className="bg-soft border-y border-line py-14 md:py-16 mt-14">
      <div className="mx-auto max-w-3xl px-5 md:px-8">
        <h2 className="h-display text-2xl md:text-3xl text-ink text-center">What happens next</h2>

        <div className="mt-9 space-y-3">
          {steps.map((s) => {
            const Icon = s.icon;
            const done = s.state === 'done';
            return (
              // Not scroll-animated on purpose — this section must be readable
              // the moment the page paints, however the visitor got here.
              <div
                key={s.t}
                className={`flex gap-4 rounded-2xl border p-5 ${done ? 'border-gGreen/30 bg-gGreen/5' : 'border-line bg-white shadow-soft'}`}
              >
                <div className={`shrink-0 h-11 w-11 rounded-xl flex items-center justify-center ${done ? 'bg-gGreen text-white' : 'bg-bluesoft text-blue'}`}>
                  <Icon className="h-5 w-5" strokeWidth={done ? 3 : 2} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h3 className="font-display font-extrabold text-ink">{s.t}</h3>
                    {s.when && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-bluesoft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue">
                        <Clock className="h-3 w-3" /> {s.when}
                      </span>
                    )}
                    {done && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gGreen/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gGreen">
                        Complete
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm text-slate1 leading-relaxed">{s.d}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
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
    <section className="bg-white py-14 md:py-16">
      <div className="mx-auto max-w-3xl px-5 md:px-8 grid md:grid-cols-2 gap-8">
        <div>
          <span className="eyebrow-light">Two minutes of prep</span>
          <h2 className="h-display text-2xl md:text-3xl text-ink mt-4">
            Have these handy for the call
          </h2>
          <p className="mt-3 text-slate1 leading-relaxed">
            Nothing formal — ballpark numbers are fine. It just means we spend the call on your plan
            instead of on discovery questions.
          </p>
        </div>
        <ul className="space-y-2.5">
          {items.map((x) => (
            <li key={x} className="flex gap-2.5 rounded-xl border border-line bg-soft px-4 py-3">
              <CheckCircle2 className="h-4 w-4 text-gGreen shrink-0 mt-0.5" />
              <span className="text-sm text-slate1 leading-snug">{x}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function MeanwhileStrip() {
  return (
    <section className="bg-soft border-y border-line py-12">
      <div className="mx-auto max-w-3xl px-5 md:px-8">
        <div className="text-center text-xs font-bold uppercase tracking-[0.22em] text-slate2">
          While you wait
        </div>
        <div className="mt-6 grid sm:grid-cols-2 gap-3">
          <a href="/calculator" className="group rounded-2xl border border-line bg-white p-5 hover:border-blue/40 hover:shadow-soft transition-all">
            <div className="h-10 w-10 rounded-xl bg-bluesoft flex items-center justify-center">
              <Calculator className="h-5 w-5 text-blue" />
            </div>
            <div className="mt-3 font-display font-extrabold text-ink">Run the ROI calculator</div>
            <p className="mt-1 text-sm text-slate1 leading-snug">
              See what a given budget could turn into in leads, booked jobs, and revenue.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-blue">
              Open calculator <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </a>

          <div className="rounded-2xl border border-line bg-white p-5">
            <div className="flex">
              {[1, 2, 3, 4, 5].map((i) => <Star key={i} className="h-4 w-4 fill-gReview text-gReview" />)}
            </div>
            <p className="mt-3 text-sm text-ink leading-relaxed">
              "Our quote requests jumped within weeks. We can finally see exactly which jobs came from
              which campaign."
            </p>
            <div className="mt-3 flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-full bg-blue flex items-center justify-center text-white font-extrabold text-xs">JS</div>
              <div>
                <div className="text-sm font-bold text-ink">John Scime</div>
                <a href="https://sevenstoneslandscape.ca" target="_blank" rel="noreferrer" className="text-[11px] text-blue hover:underline flex items-center gap-1 font-medium">
                  <Globe className="h-3 w-3" /> Seven Stones Landscape
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-navy text-white">
      <div className="mx-auto max-w-5xl px-5 md:px-8 py-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-5">
          <a href="/" className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white p-1.5 flex items-center justify-center">
              <img src="/tlmlogo.png" alt="" className="h-full w-full object-contain" />
            </div>
            <div className="leading-tight">
              <div className="font-extrabold tracking-tight text-sm">Trade Leads Marketing</div>
              <div className="text-[9px] uppercase tracking-[0.25em] text-brand font-bold">tradeleadsmarketing.ca</div>
            </div>
          </a>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
            <a href={PHONE_HREF} className="text-white/85 hover:text-brand flex items-center gap-1.5"><Phone className="h-4 w-4" /> {PHONE_DISPLAY}</a>
            <a href={`mailto:${EMAIL}`} className="text-white/85 hover:text-brand flex items-center gap-1.5"><Mail className="h-4 w-4" /> Email us</a>
            <a href="/" className="text-white/85 hover:text-brand flex items-center gap-1.5"><ArrowLeft className="h-4 w-4" /> Back to site</a>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-white/10 text-[11px] text-white/45">
          © {new Date().getFullYear()} Trade Leads Marketing. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

/* Mobile: the call CTA never leaves the screen */
function MobileCallBar() {
  return (
    <div className="sm:hidden fixed bottom-0 inset-x-0 z-40 border-t border-line bg-white/95 backdrop-blur px-4 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))]">
      <a href={PHONE_HREF} className="btn-primary w-full text-base py-3.5">
        <Phone className="h-5 w-5" /> Call {PHONE_DISPLAY}
      </a>
    </div>
  );
}

export default function ThankYou() {
  const [name, setName] = useState('');

  useEffect(() => {
    try {
      const raw = new URLSearchParams(window.location.search).get('name') || '';
      // Only ever echo a plain first name back onto the page.
      const safe = raw.replace(/[^\p{L}\p{M}'\- ]/gu, '').trim().slice(0, 24);
      setName(safe);
    } catch { /* no query string — generic greeting */ }
  }, []);

  return (
    <div className="min-h-screen bg-white text-ink antialiased overflow-x-hidden pb-20 sm:pb-0">
      <Header />
      <main>
        <Hero name={name} />
        <CallCard />
        <NextSteps />
        <Prep />
        <MeanwhileStrip />
      </main>
      <Footer />
      <MobileCallBar />
    </div>
  );
}
