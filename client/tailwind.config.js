/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Phase 3.5 palette
        bg: '#080b12',
        panel: '#0d1117',
        card: '#0d1117',
        'card-hover': '#131c28',
        border: '#1e2d40',
        'border-hover': '#2d4a6b',
        accent: '#38bdf8',
        positive: '#22c55e',
        negative: '#ef4444',
        orange: '#f97316',
        yellow: '#eab308',
        muted: '#64748b',
        label: '#94a3b8',
        primary: '#e2e8f0',
        // keep old aliases for backwards compat in existing tabs
        'bg-old': '#0a0a0f',
        'card-old': '#13131a',
        'border-old': '#1e1e2e',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', '"Cascadia Code"', 'monospace'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
