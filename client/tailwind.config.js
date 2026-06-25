/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:           '#0c0c0c',
        panel:        '#131313',
        card:         '#1a1a1a',
        'card-hover': '#202020',
        border:       '#282828',
        'border-hover': '#3a3a3a',
        brand:        '#c0392b',
        accent:       '#38bdf8',
        positive:     '#22c55e',
        negative:     '#e74c3c',
        orange:       '#f97316',
        yellow:       '#f5c518',
        gold:         '#c9a227',
        muted:        '#524e4b',
        label:        '#9c9390',
        primary:      '#ede9e4',
      },
      fontFamily: {
        display: ['"Barlow Condensed"', 'Oswald', 'sans-serif'],
        mono:    ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
        sans:    ['"Space Grotesk"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '2px',
        sm: '1px',
        md: '4px',
        lg: '4px',
        xl: '6px',
        '2xl': '8px',
      },
    },
  },
  plugins: [],
};
