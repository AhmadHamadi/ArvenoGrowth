/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './calculator.html',
    './apply.html',
    './thank-you.html',
    './contract.html',
    './contracts.html',
    './sign.html',
    './src/**/*.{js,jsx,ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        navy:     '#0A1B3D',
        navydeep: '#06122B',
        charcoal: '#0F1A33',
        brand:    '#F37021',
        branddeep:'#D85A0F',
        blue:     '#1E55C7',
        bluedeep: '#143E96',
        bluesoft: '#EAF1FE',
        ink:      '#0F172A',
        slate1:   '#475569',
        slate2:   '#64748B',
        slate3:   '#94A3B8',
        line:     '#E2E8F0',
        soft:     '#F8FAFC',
        gReview:  '#FBBC05',
        gGreen:   '#34A853',
        gRed:     '#EA4335',
        gBlue:    '#4285F4',

        /* ---- Work-order palette, used by /apply and /thank-you ----
           A warm paper ground and a near-black warm ink, so the funnel reads
           like trade paperwork rather than another white SaaS page. Safety
           orange is the only accent; the site blue is deliberately absent. */
        paper:     '#F2EFE9',
        paper2:    '#E9E4DA',
        paperEdge: '#D6CFC0',
        inkd:      '#15140F',
        inkd2:     '#3C3931',
        inkd3:     '#6B6555',   /* 5.06:1 on paper, 4.58:1 on paper2 */
        /* The accent splits by ground. Bright orange only clears 2.56:1 on
           paper, so it is reserved for the ink ground (6.28:1). Anything on
           paper, and any solid orange button carrying paper-coloured text,
           uses the deep tone, which clears 5.11:1. */
        brandpress:'#C24700',
        brandink:  '#B04000',
        brandink2: '#8F3300'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        /* Archivo is a signage grotesque — closer to what gets stencilled on a
           truck door than to the Inter default. IBM Plex Mono carries the
           docket numbers, field labels, and step counters. */
        archivo: ['Archivo', 'system-ui', 'sans-serif'],
        plex: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace']
      },
      boxShadow: {
        glow:     '0 0 0 1px rgba(243,112,33,0.28), 0 10px 40px -10px rgba(243,112,33,0.50)',
        glowBlue: '0 0 0 1px rgba(30,85,199,0.30),  0 10px 40px -10px rgba(30,85,199,0.55)',
        soft:     '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -8px rgba(15,23,42,0.10)',
        lifted:   '0 2px 4px rgba(15,23,42,0.04), 0 24px 48px -16px rgba(15,23,42,0.18)',
        ring:     '0 0 0 8px rgba(30,85,199,0.08)'
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(243,112,33,0.55)' },
          '50%':       { boxShadow: '0 0 0 14px rgba(243,112,33,0)' }
        },
        floaty: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':       { transform: 'translateY(-6px)' }
        },
        sweep: {
          '0%':   { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' }
        },
        marquee: {
          '0%':   { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' }
        }
      },
      animation: {
        pulseGlow: 'pulseGlow 2.4s ease-out infinite',
        floaty:    'floaty 4s ease-in-out infinite',
        sweep:     'sweep 2.5s ease-in-out infinite',
        marquee:   'marquee 30s linear infinite'
      }
    }
  },
  plugins: []
};
