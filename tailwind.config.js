/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{html,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'terminal-bg': '#1a1b26',
        'terminal-fg': '#a9b1d6',
        'sidebar-bg': '#16161e',
        'sidebar-hover': '#1f2335',
        'accent': '#7aa2f7',
        'accent-hover': '#89b4fa',
        'success': '#9ece6a',
        'warning': '#e0af68',
        'error': '#f7768e',
        'surface': '#24283b',
        'surface-light': '#2f3549',
        'border': '#3b4261',
      },
    },
  },
  plugins: [],
};
