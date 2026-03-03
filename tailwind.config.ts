import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bomjur: {
          bg: '#0A0E17',
          card: '#111827',
          'card-hover': '#1A2332',
          border: '#1E293B',
          lime: '#84CC16',
          'lime-dark': '#65A30D',
          text: '#F1F5F9',
          muted: '#94A3B8',
          dim: '#64748B',
        },
      },
      fontFamily: {
        sans: ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'pulse-lime': 'pulseLime 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseLime: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(132, 204, 22, 0.4)' },
          '50%': { boxShadow: '0 0 0 8px rgba(132, 204, 22, 0)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
