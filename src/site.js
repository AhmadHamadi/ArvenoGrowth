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

document.querySelectorAll('[data-comparison]').forEach((comparison) => {
  const range = comparison.querySelector('.compare-range');
  const before = comparison.querySelector('.comparison-before-wrap');
  const handle = comparison.querySelector('.compare-handle');
  const update = () => {
    const value = `${range.value}%`;
    before.style.width = value;
    handle.style.left = value;
  };
  range.addEventListener('input', update);
  update();
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
  const steps = [...form.querySelectorAll('.form-step')];
  const stepNumber = form.querySelector('#step-number');
  const progressFill = form.querySelector('#progress-fill');
  const status = form.querySelector('#form-status');
  let current = 0;

  const showStep = (index) => {
    current = index;
    steps.forEach((step, i) => step.classList.toggle('active', i === current));
    stepNumber.textContent = String(current + 1);
    progressFill.style.width = `${((current + 1) / steps.length) * 100}%`;
    status.textContent = '';
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  form.querySelectorAll('.form-next').forEach((button) => button.addEventListener('click', () => {
    const fields = [...steps[current].querySelectorAll('input,select,textarea')].filter((field) => field.type !== 'hidden');
    const invalid = fields.find((field) => !field.checkValidity());
    if (invalid) {
      invalid.reportValidity();
      invalid.focus();
      return;
    }
    showStep(Math.min(current + 1, steps.length - 1));
  }));
  form.querySelectorAll('.form-back').forEach((button) => button.addEventListener('click', () => showStep(Math.max(current - 1, 0))));

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
