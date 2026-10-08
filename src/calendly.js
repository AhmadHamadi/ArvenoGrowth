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
      bookingUrl.searchParams.set('hide_gdpr_banner', '1');
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
