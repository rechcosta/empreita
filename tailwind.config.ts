import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Primary brand — #FF7A00 (spec) at 500, #E66900 (spec hover) at 600.
        // Soft tint #FFF4E6 (spec) at 50. Scale provides intermediates for UI states.
        brand: {
          50:  '#FFF4E6',
          100: '#FFE4C2',
          200: '#FFCB8A',
          300: '#FFB052',
          400: '#FF961F',
          500: '#FF7A00',
          600: '#E66900',
          700: '#B85200',
          800: '#8A3E00',
          900: '#5C2900',
        },
      },
      backgroundColor: {
        primary:   '#FFFFFF',
        secondary: '#F5F5F5',
        soft:      '#FAFAFA',
      },
      textColor: {
        primary:   '#111827',
        secondary: '#6B7280',
      },
      borderColor: {
        DEFAULT: '#E5E7EB',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config 