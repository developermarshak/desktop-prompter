/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular']
      },
      colors: {
        ink: {
          50: '#f7f7f4',
          100: '#ecebe6',
          200: '#d6d2c7',
          300: '#b6b0a0',
          400: '#96907d',
          500: '#7a7564',
          600: '#5e5a4d',
          700: '#434034',
          800: '#2b281f',
          900: '#1a1710'
        },
        amber: {
          50: '#fff6e6',
          100: '#ffe6bf',
          200: '#ffd08a',
          300: '#ffb34d',
          400: '#ff9b1a',
          500: '#e67f00',
          600: '#b96200',
          700: '#8a4700',
          800: '#5c2d00',
          900: '#2f1500'
        }
      },
      boxShadow: {
        panel: '0 18px 40px rgba(14, 13, 9, 0.25)'
      },
      backgroundImage: {
        'grain': 'radial-gradient(circle at 1px 1px, rgba(26, 23, 16, 0.08) 1px, transparent 0)'
      }
    }
  },
  plugins: []
}
