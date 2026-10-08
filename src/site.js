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
    submit.innerHTML = 'Sending your brief…';
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
      submit.innerHTML = 'Send my growth brief <span>↗</span>';
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
  actionBar.innerHTML = '<a class="mobile-options-link" href="/#audit-form">See my growth options</a><a class="mobile-call-link" href="tel:+12894891167">Call Arveno</a>';
  document.body.append(actionBar);
}
