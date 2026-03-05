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
          bg: '#f8fafc',
          card: '#ffffff',
          'card-hover': '#f1f5f9',
          border: '#e2e8f0',
          primary: '#0ea5e9',
          'primary-dark': '#0284c7',
          text: '#0f172a',
          muted: '#475569',
          dim: '#64748b',
          accent: '#f97316',
          success: '#10b981',
          danger: '#ef4444',
        },
      },
      fontFamily: {
        sans: ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'pulse-primary': 'pulsePrimary 2s infinite',
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
        pulsePrimary: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(14, 165, 233, 0.4)' },
          '50%': { boxShadow: '0 0 0 8px rgba(14, 165, 233, 0)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
