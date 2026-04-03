import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary)',
          light:   'var(--color-primary-light)',
          dark:    'var(--color-primary-dark)',
        },
        md: {
          surface:                'var(--md-sys-color-surface)',
          'surface-variant':      'var(--md-sys-color-surface-variant)',
          'surface-container':    'var(--md-sys-color-surface-container)',
          'surface-container-high': 'var(--md-sys-color-surface-container-high)',
          'on-surface':           'var(--md-sys-color-on-surface)',
          'on-surface-variant':   'var(--md-sys-color-on-surface-variant)',
          outline:                'var(--md-sys-color-outline)',
          'outline-variant':      'var(--md-sys-color-outline-variant)',
          'primary-container':    'var(--md-sys-color-primary-container)',
          'on-primary-container': 'var(--md-sys-color-on-primary-container)',
          'secondary-container':  'var(--md-sys-color-secondary-container)',
          'on-secondary-container': 'var(--md-sys-color-on-secondary-container)',
          error:                  'var(--md-sys-color-error)',
          'error-container':      'var(--md-sys-color-error-container)',
          'on-error-container':   'var(--md-sys-color-on-error-container)',
          'warning-container':    'var(--md-sys-color-warning-container)',
          'on-warning-container': 'var(--md-sys-color-on-warning-container)',
          'night-container':      'var(--md-sys-color-night-container)',
          'on-night-container':   'var(--md-sys-color-on-night-container)',
        },
      },
      borderRadius: {
        'md-xs':   'var(--md-sys-shape-corner-extra-small)',
        'md-sm':   'var(--md-sys-shape-corner-small)',
        'md-md':   'var(--md-sys-shape-corner-medium)',
        'md-lg':   'var(--md-sys-shape-corner-large)',
        'md-xl':   'var(--md-sys-shape-corner-extra-large)',
        'md-full': 'var(--md-sys-shape-corner-full)',
      },
      boxShadow: {
        'md-1': 'var(--md-sys-elevation-level1)',
        'md-2': 'var(--md-sys-elevation-level2)',
        'md-3': 'var(--md-sys-elevation-level3)',
      },
      fontFamily: {
        sans:     ['var(--font-noto)', 'sans-serif'],
        dm:       ['var(--font-dm)', 'sans-serif'],
        mono:     ['var(--font-dm)', 'monospace'],
        'dm-mono': ['var(--font-dm-mono)', 'monospace'],
      },
      transitionTimingFunction: {
        'md-standard':   'var(--md-sys-motion-easing-standard)',
        'md-decelerate': 'var(--md-sys-motion-easing-emphasized-decelerate)',
        'md-accelerate': 'var(--md-sys-motion-easing-emphasized-accelerate)',
      },
      transitionDuration: {
        'md-s2': 'var(--md-sys-motion-duration-short2)',
        'md-s4': 'var(--md-sys-motion-duration-short4)',
        'md-m2': 'var(--md-sys-motion-duration-medium2)',
      },
    },
  },
  plugins: [],
};

export default config;
