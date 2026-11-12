document.documentElement.classList.add('js');

const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('.primary-nav');
menuButton?.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  nav?.classList.toggle('open', open);
});
nav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
  menuButton?.setAttribute('aria-expanded', 'false');
  nav.classList.remove('open');
}));
nav?.querySelectorAll('.nav-dropdown').forEach((dropdown) => {
  dropdown.addEventListener('toggle', () => {
    if (!dropdown.open) return;
    nav.querySelectorAll('.nav-dropdown').forEach((other) => {
      if (other !== dropdown) other.open = false;
    });
  });
});

document.querySelectorAll('[data-comparison]').forEach((comparison) => {
  const range = comparison.querySelector('.compare-range');
  const before = comparison.querySelector('.comparison-before-wrap');
  const beforeImage = before?.querySelector('img');
  const frame = comparison.querySelector('.comparison-frame');
  const handle = comparison.querySelector('.compare-handle');
  const update = () => {
    const value = `${range.value}%`;
    before.style.width = value;
    handle.style.left = value;
    if (frame && beforeImage) {
      beforeImage.style.width = `${frame.clientWidth}px`;
      beforeImage.style.height = `${frame.clientHeight}px`;
    }
  };
  range.addEventListener('input', update);
  update();
  if ('ResizeObserver' in window) new ResizeObserver(update).observe(frame);
});

const revealItems = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  }), { threshold: 0.12 });
  revealItems.forEach((item) => observer.observe(item));
} else revealItems.forEach((item) => item.classList.add('is-visible'));

const year = document.querySelector('#year');
if (year) year.textContent = new Date().getFullYear();

const form = document.querySelector('#growth-form');
if (form) {
  const status = form.querySelector('#form-status');
  form.querySelectorAll('.choice-card input, .choice-pills input').forEach((option) => {
    option.addEventListener('change', () => {
      form.querySelectorAll(`input[name="${CSS.escape(option.name)}"]`).forEach((peer) => {
        peer.closest('.choice-card, label')?.classList.toggle('is-selected', peer.checked);
      });
    });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    submit.innerHTML = 'Sending your details…';
    status.textContent = '';
    try {
      const response = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form)))
      });
      if (!response.ok) throw new Error('The request could not be sent. Please try again or call us.');
      window.location.assign('/thank-you');
    } catch (error) {
      status.textContent = error.message || 'Something went wrong. Please try again or contact us directly.';
      submit.disabled = false;
      submit.innerHTML = 'Send my details &amp; choose a time <span>↗</span>';
    }
  });
}

// Native details menus support hover, keyboard, Escape, and outside dismissal.
const navDropdowns = [...(nav?.querySelectorAll('.nav-dropdown') || [])];
const desktopHover = window.matchMedia('(min-width:1121px) and (hover:hover) and (pointer:fine)');
navDropdowns.forEach((dropdown) => {
  let closeTimer;
  dropdown.addEventListener('pointerenter', () => {
    if (!desktopHover.matches) return;
    clearTimeout(closeTimer);
    dropdown.dataset.pointerOpen = '';
    dropdown.open = true;
  });
  dropdown.addEventListener('pointerleave', () => {
    if (!desktopHover.matches) return;
    closeTimer = setTimeout(() => {
      if (!dropdown.contains(document.activeElement)) {
        dropdown.open = false;
        delete dropdown.dataset.pointerOpen;
      }
    }, 120);
  });
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  const expanded = navDropdowns.find((dropdown) => dropdown.open);
  navDropdowns.forEach((dropdown) => { dropdown.open = false; delete dropdown.dataset.pointerOpen; });
  if (expanded) expanded.querySelector('summary')?.focus();
  else if (menuButton?.getAttribute('aria-expanded') === 'true') {
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Open navigation');
    nav?.classList.remove('open');
    menuButton.focus();
  }
});
document.addEventListener('click', (event) => {
  if (nav?.contains(event.target) || menuButton?.contains(event.target)) return;
  navDropdowns.forEach((dropdown) => { dropdown.open = false; delete dropdown.dataset.pointerOpen; });
  menuButton?.setAttribute('aria-expanded', 'false');
  menuButton?.setAttribute('aria-label', 'Open navigation');
  nav?.classList.remove('open');
});

// Keep the next step and phone contact within reach on small screens.
if (document.querySelector('.site-header') && !document.querySelector('.mobile-action-bar')) {
  const actionBar = document.createElement('nav');
  actionBar.className = 'mobile-action-bar';
  actionBar.setAttribute('aria-label', 'Quick contact');
  actionBar.innerHTML = '<a class="mobile-options-link" href="/#audit-form">Free growth review</a><a class="mobile-call-link" href="tel:+12894891167">Call (289) 489-1167</a>';
  document.body.append(actionBar);
}

// Homepage: illustrative local-search example. All businesses are fictional.
const searchDemo = document.querySelector('[data-search-demo]');
if (searchDemo) {
  const queries = [
    { q: 'roof repair near me', you: 'Example Roofing Co.', youSite: 'exampleroofing.example', trade: 'Roofing contractor',
      others: ['Northgate Roofing', 'Bayview Roof Services', 'Cedarline Exteriors', 'RoofFinder Directory', 'Maple Street Roofing'] },
    { q: 'furnace repair Denver', you: 'Example Heating & Cooling', youSite: 'exampleheating.example', trade: 'HVAC contractor',
      others: ['Front Range Comfort', 'Summit Air Heating', 'Mile High Mechanical', 'HomeServ Directory', 'Pinecrest HVAC'] },
    { q: 'landscaper Raleigh', you: 'Example Landscapes', youSite: 'examplelandscapes.example', trade: 'Landscaper',
      others: ['Oak City Yard Works', 'Greenway Landscaping', 'Stonecrest Gardens', 'YardPro Directory', 'Pine Hollow Lawn & Garden'] }
  ];
  // Where the example business sits after each step (null = not in the map results).
  const ranks = [{ map: null, web: 6 }, { map: null, web: 5 }, { map: null, web: 3 }, { map: 3, web: 2 }, { map: 2, web: 2 }];
  const copy = [
    ['Before we start', 'The example business sits low in the results: a vague page title, thin service pages, an incomplete Business Profile, and few reviews.'],
    ['Step 1 · Audit', 'Page titles now say the service and the area, so the page clearly matches what people search for.'],
    ['Step 2 · Plan', 'Dedicated service pages answer real questions about cost factors, the service area, and what happens next.'],
    ['Step 3 · Optimize', 'A complete, accurate Business Profile with services, hours, and photos helps the business appear in the map results.'],
    ['Step 4 · Report', 'Steady review requests after finished jobs and monthly reporting show which searches turn into booked work.']
  ];
  let query = 0;
  let step = 0;
  const el = (sel) => searchDemo.querySelector(sel);
  const listItem = (rank, name, site, isYou, sub) => {
    const li = document.createElement('li');
    if (isYou) li.className = 'is-you';
    const num = document.createElement('span'); num.textContent = rank;
    const body = document.createElement('div');
    const b = document.createElement('b'); b.textContent = name;
    if (isYou) { const tag = document.createElement('em'); tag.textContent = 'Example'; b.append(' ', tag); }
    const small = document.createElement('small'); small.textContent = sub || site;
    body.append(b, small);
    li.append(num, body);
    return li;
  };
  const render = () => {
    const data = queries[query];
    const pos = ranks[step];
    const order = (place) => {
      const list = [...data.others];
      if (place) list.splice(place - 1, 0, data.you);
      return list;
    };
    const map = el('[data-map]');
    const web = el('[data-web]');
    map.replaceChildren(...order(pos.map).filter((n) => !n.includes('Directory')).slice(0, 3)
      .map((name, i) => listItem(i + 1, name, '', name === data.you, `${data.trade} · Open now`)));
    web.replaceChildren(...order(pos.web).slice(0, 6)
      .map((name, i) => listItem(i + 1, name, name === data.you ? data.youSite : `${name.toLowerCase().replace(/[^a-z]+/g, '')}.example`, name === data.you)));
    el('[data-query-text]').textContent = data.q;
    el('[data-step-title]').textContent = copy[step][0];
    el('[data-step-text]').textContent = copy[step][1];
    el('[data-map-rank]').textContent = pos.map ? `#${pos.map}` : 'Not shown';
    el('[data-web-rank]').textContent = `#${pos.web}`;
    el('[data-checks]').querySelectorAll('li').forEach((li, i) => li.classList.toggle('is-done', i < step));
    el('[data-next]').textContent = step === 0 ? 'Start' : step === 4 ? 'Start over' : 'Next step';
    searchDemo.querySelectorAll('[data-step]').forEach((btn) => {
      const n = Number(btn.dataset.step);
      btn.classList.toggle('is-done', n <= step);
      btn.setAttribute('aria-current', n === step ? 'step' : 'false');
    });
    searchDemo.querySelectorAll('[data-query]').forEach((btn) => btn.setAttribute('aria-pressed', String(Number(btn.dataset.query) === query)));
  };
  searchDemo.querySelectorAll('[data-step]').forEach((btn) => btn.addEventListener('click', () => { step = Number(btn.dataset.step); render(); }));
  searchDemo.querySelectorAll('[data-query]').forEach((btn) => btn.addEventListener('click', () => { query = Number(btn.dataset.query); step = 0; render(); }));
  el('[data-next]').addEventListener('click', () => { step = step === 4 ? 0 : step + 1; render(); });
  render();
}

// Open a <details> block when a link points straight at it (e.g. the guarantee terms).
const openTargetDetails = () => {
  const target = window.location.hash && document.getElementById(window.location.hash.slice(1));
  if (target && target.tagName === 'DETAILS') target.open = true;
};
window.addEventListener('hashchange', openTargetDetails);
openTargetDetails();
