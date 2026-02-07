/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dark Mode Base Colors
        'jungle': '#0B2F1F',
        'space': '#0A0E27',
        'neon-cyan': '#00D9FF',
        'neon-green': '#39FF14',
        // Neon color variants
        'neon-cyan-bright': '#66E7FF',
        'neon-green-bright': '#7FFF66',
      },
      fontFamily: {
        'heading': ['Teko', 'sans-serif'],
        'body': ['Montserrat', 'sans-serif'],
        'mono': ['Roboto Mono', 'monospace'],
      },
      keyframes: {
        fadeSlideIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        neonPulse: {
          '0%, 100%': {
            textShadow: '0 0 10px rgba(0,217,255,0.8), 0 0 20px rgba(0,217,255,0.4)',
            filter: 'brightness(1)'
          },
          '50%': {
            textShadow: '0 0 15px rgba(0,217,255,1), 0 0 30px rgba(0,217,255,0.6)',
            filter: 'brightness(1.2)'
          },
        },
        neonGlow: {
          '0%, 100%': {
            boxShadow: '0 0 15px rgba(57,255,20,0.6), inset 0 0 10px rgba(57,255,20,0.2)'
          },
          '50%': {
            boxShadow: '0 0 25px rgba(57,255,20,0.8), inset 0 0 15px rgba(57,255,20,0.3)'
          },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideInUp: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
      animation: {
        'fade-slide-in': 'fadeSlideIn 0.2s ease-out',
        'neon-pulse': 'neonPulse 2s ease-in-out infinite',
        'neon-glow': 'neonGlow 2s ease-in-out infinite',
        'slide-in-right': 'slideInRight 0.5s ease-out',
        'slide-in-left': 'slideInLeft 0.5s ease-out',
        'slide-in-up': 'slideInUp 0.5s ease-out',
        'scanline': 'scanline 4s linear infinite',
      },
      boxShadow: {
        'neon-cyan': '0 0 15px rgba(0,217,255,0.6), inset 0 0 10px rgba(0,217,255,0.2)',
        'neon-green': '0 0 15px rgba(57,255,20,0.6), inset 0 0 10px rgba(57,255,20,0.2)',
        'neon-cyan-strong': '0 0 25px rgba(0,217,255,0.8), inset 0 0 15px rgba(0,217,255,0.3)',
        'neon-green-strong': '0 0 25px rgba(57,255,20,0.8), inset 0 0 15px rgba(57,255,20,0.3)',
      },
    },
  },
  plugins: [],
};
