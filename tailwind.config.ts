import forms from '@tailwindcss/forms';
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        obsidian: '#070812',
        ink: '#0B1020',
        cyan: '#5DE7FF',
        violet: '#8B5CF6',
        gold: '#F6C96B'
      },
      boxShadow: {
        glow: '0 0 70px rgba(93, 231, 255, 0.22)'
      }
    }
  },
  plugins: [forms]
};

export default config;
