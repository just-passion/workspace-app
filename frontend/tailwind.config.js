/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:             '#080B12',
        surface:        '#0E1220',
        'surface-2':    '#131929',
        card:           '#171E2E',
        'card-hover':   '#1C2438',
        border:         'rgba(255,255,255,0.06)',
        accent:         '#4F6EF7',
        'accent-light': '#7B97FF',
        'accent-dim':   'rgba(79,110,247,0.15)',
        green:          '#22D3A4',
        amber:          '#F5A623',
        red:            '#F87171',
        purple:         '#A78BFA',
        text1:          '#F0F2FF',
        text2:          '#8892B0',
        text3:          '#4A5578',
      },
      fontFamily: {
        sans: ['Geist', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'monospace'],
      },
      borderRadius: {
        sm:  '6px',
        DEFAULT: '10px',
        lg:  '14px',
        xl:  '18px',
        '2xl': '22px',
      },
      boxShadow: {
        sm:   '0 1px 3px rgba(0,0,0,0.4)',
        DEFAULT: '0 4px 16px rgba(0,0,0,0.5)',
        lg:   '0 8px 40px rgba(0,0,0,0.7)',
        glow: '0 0 40px rgba(79,110,247,0.15)',
        accent: '0 4px 20px rgba(79,110,247,0.35)',
      },
      animation: {
        'fade-in':  'fade-in 0.2s ease forwards',
        'slide-up': 'slide-up 0.25s cubic-bezier(0.16,1,0.3,1) forwards',
        'scale-in': 'scale-in 0.2s cubic-bezier(0.16,1,0.3,1) forwards',
        'shimmer':  'shimmer 1.5s infinite',
      },
      keyframes: {
        'fade-in':  { from: { opacity: 0 }, to: { opacity: 1 } },
        'slide-up': { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        'scale-in': { from: { opacity: 0, transform: 'scale(0.95)' }, to: { opacity: 1, transform: 'scale(1)' } },
        'shimmer':  { from: { backgroundPosition: '200% 0' }, to: { backgroundPosition: '-200% 0' } },
      },
    },
  },
  plugins: [],
};
