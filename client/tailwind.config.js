/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Palette — synced with CSS custom properties in index.css
        bg:           '#07090f',
        panel:        '#0b0f1a',
        card:         '#0e1420',
        'card-hover': '#131d2e',
        border:       '#1a2840',
        'border-hover': '#2a4266',
        accent:       '#38bdf8',
        positive:     '#22c55e',
        negative:     '#f05454',
        orange:       '#f97316',
        yellow:       '#eab308',
        muted:        '#506070',
        label:        '#8ea3bc',
        primary:      '#dde6f0',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
        sans: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
