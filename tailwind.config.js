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
    './deck.html',
    './src/**/*.{js,jsx,ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        navy:     '#091D59',
        navydeep: '#06143f',
        charcoal: '#11234c',
        brand:    '#0F59F5',
        branddeep:'#0B4DDD',
        blue:     '#1559E8',
        bluedeep: '#0A1E5E',
        bluesoft: '#EDF4FF',
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

        /* Shared Arveno blue palette for forms, tools, and the marketing site. */
        paper:     '#F4F7FF',
        paper2:    '#EAF1FF',
        paperEdge: '#DCE5F4',
        inkd:      '#11234c',
        inkd2:     '#344563',
        inkd3:     '#65728f',   /* 5.06:1 on paper, 4.58:1 on paper2 */
        /* Deep blue keeps button text readable on light surfaces. */
        brandpress:'#0B4DDD',
        brandink:  '#0B4DDD',
        brandink2: '#083aa9'
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
        glow:     '0 0 0 1px rgba(15,89,245,0.28), 0 10px 40px -10px rgba(15,89,245,0.50)',
        glowBlue: '0 0 0 1px rgba(30,85,199,0.30),  0 10px 40px -10px rgba(30,85,199,0.55)',
        soft:     '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -8px rgba(15,23,42,0.10)',
        lifted:   '0 2px 4px rgba(15,23,42,0.04), 0 24px 48px -16px rgba(15,23,42,0.18)',
        ring:     '0 0 0 8px rgba(30,85,199,0.08)'
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(15,89,245,0.55)' },
          '50%':       { boxShadow: '0 0 0 14px rgba(15,89,245,0)' }
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
