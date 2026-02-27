import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: 'rgb(var(--paper) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        rust: 'rgb(var(--rust) / <alpha-value>)',
        sage: 'rgb(var(--sage) / <alpha-value>)',
        coal: 'rgb(var(--coal) / <alpha-value>)'
      },
      boxShadow: {
        card: '0 24px 60px -28px rgba(22, 22, 20, 0.35)'
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        }
      },
      animation: {
        'fade-up': 'fade-up 0.6s ease-out both'
      }
    }
  },
  plugins: []
};

export default config;
