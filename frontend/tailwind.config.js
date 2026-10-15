/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Philosopher"', '"Cormorant Garamond"', 'Georgia', 'serif'],
        fantasy: ['"Philosopher"', '"Cormorant Garamond"', 'Georgia', 'serif'],
        arcane: ['"Cinzel Decorative"', '"Philosopher"', 'Georgia', 'serif'],
        serif: ['"Cormorant Garamond"', '"Philosopher"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      letterSpacing: {
        'arcane-wide': '0.18em',
        'arcane-tag': '0.25em',
      },
      backgroundImage: {
        'aegis-vertical': 'linear-gradient(to top, #1e40af 0%, #0284c7 35%, #06b6d4 70%, #67e8f9 100%)',
      },
      boxShadow: {
        'arcane-glow': '0 0 25px -5px rgba(6, 182, 212, 0.4)',
        'arcane-sm': '0 0 15px -3px rgba(6, 182, 212, 0.25)',
      },
    },
  },
  plugins: [],
}