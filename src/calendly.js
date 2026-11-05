const booking = document.querySelector('#calendly-booking');
if (booking) {
  const rawUrl = import.meta.env.VITE_CALENDLY_URL?.trim();
  if (rawUrl) {
    let bookingUrl;
    try {
      bookingUrl = new URL(rawUrl);
    } catch {
      bookingUrl = null;
    }

    // The public booking destination is configuration, not user input.
    // Restrict it to Calendly so a bad environment value cannot embed another site.
    if (bookingUrl?.protocol === 'https:' && (bookingUrl.hostname === 'calendly.com' || bookingUrl.hostname.endsWith('.calendly.com'))) {
      try {
        const saved = JSON.parse(sessionStorage.getItem('arveno-calendly-prefill') || '{}');
        sessionStorage.removeItem('arveno-calendly-prefill');
        const name = String(saved.name || '').replace(/[\r\n\0-\x1f]/g, '').trim().slice(0, 120);
        const email = String(saved.email || '').replace(/[\r\n\0-\x1f]/g, '').trim().slice(0, 200);
        if (name) bookingUrl.searchParams.set('name', name);
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) bookingUrl.searchParams.set('email', email);
      } catch { /* Prefill is optional; booking remains available without it. */ }
      bookingUrl.searchParams.set('hide_gdpr_banner', '1');
      const reportBookingConfirmation = () => {
        let bookingFollowupToken;
        try {
          bookingFollowupToken = sessionStorage.getItem('arveno-booking-followup-token');
          if (!bookingFollowupToken) return;
        } catch { return; }
        const key = `arveno:booking-confirmed:${bookingFollowupToken.slice(0, 48)}`;
        try {
          if (sessionStorage.getItem(key)) return;
          sessionStorage.setItem(key, '1');
        } catch { /* Tracking is best-effort when storage is unavailable. */ }
        const body = { event: 'booking_confirmed', pagePath: window.location.pathname, bookingFollowupToken };
        try { sessionStorage.removeItem('arveno-booking-followup-token'); } catch { /* Best-effort cleanup. */ }
        fetch('/api/booking-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          keepalive: true
        }).catch(() => {});
      };

      window.addEventListener('message', (message) => {
        if (message.origin !== 'https://calendly.com') return;
        if (message.data?.event === 'calendly.event_scheduled') reportBookingConfirmation();
      });

      const fallback = booking.querySelector('.booking-fallback');
      fallback?.replaceChildren(document.createTextNode('The scheduler is loading. If it does not appear, '));
      if (fallback) {
        const link = document.createElement('a');
        link.href = bookingUrl.href;
        link.textContent = 'open the booking page';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        fallback.append(link, document.createTextNode('.'));
      }

      const script = document.createElement('script');
      script.src = 'https://assets.calendly.com/assets/external/widget.js';
      script.async = true;
      script.onload = () => {
        if (!window.Calendly?.initInlineWidget) return;
        if (fallback) fallback.hidden = true;
        window.Calendly.initInlineWidget({
          url: bookingUrl.href,
          parentElement: booking,
          resize: true
        });
      };
      document.head.append(script);
    } else {
      console.error('VITE_CALENDLY_URL must be a valid HTTPS Calendly event URL.');
    }
  }
}
