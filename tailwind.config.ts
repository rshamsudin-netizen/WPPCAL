import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        wa: {
          green: '#128C7E',
          'green-dark': '#075E54',
          'green-light': '#25D366',
          'bubble-out': '#DCF8C6',
          'bubble-in': '#FFFFFF',
          bg: '#E5DDD5',
          'input-bg': '#F0F0F0',
          text: '#111B21',
          'text-secondary': '#667781',
          'text-muted': '#8696A0',
        },
      },
      keyframes: {
        'bounce-dot': {
          '0%, 80%, 100%': { transform: 'scale(0.6)', opacity: '0.4' },
          '40%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        'bounce-dot': 'bounce-dot 1.2s infinite ease-in-out',
      },
    },
  },
  plugins: [],
};

export default config;
