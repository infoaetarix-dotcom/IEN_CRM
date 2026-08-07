import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

// Design tokens from README §10.7 — editorial aesthetic.
const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: { '2xl': '1280px' },
    },
    extend: {
      colors: {
        // Brand palette
        navy: '#0A1A2F',
        cream: '#F2EBDD',
        accent: '#C8872E',
        ink: '#0B1F33',
        paper: '#F5F1E8',
        muted: '#6B7A8D',
        line: 'rgba(11,31,51,0.12)',
        // Marketing site palette (app/page.tsx only) — deliberately separate
        // from the CRM chrome tokens above so the tenant-facing app keeps its
        // own identity while the Aetarix platform site gets its own.
        marketing: {
          navy: '#0B1220',
          blue: '#2563EB',
          cyan: '#06B6D4',
          offwhite: '#F8F7F3',
          gray: '#F3F5F8',
          ink: '#111827',
        },
        // shadcn semantic tokens (mapped to CSS vars in globals.css)
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted_: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        // Display serif for the marketing page's major headings only.
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
