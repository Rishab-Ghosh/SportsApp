/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a0f',
        card: '#13131a',
        border: '#1e1e2e',
        accent: '#3b82f6',
        positive: '#22c55e',
        negative: '#ef4444',
        muted: '#6b7280',
        label: '#9ca3af',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', '"Cascadia Code"', 'monospace'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
