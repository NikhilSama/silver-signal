import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Signal colors from PRD Section 5.2
        signal: {
          green: '#2E7D32',
          amber: '#F57F17',
          red: '#C62828',
          gray: '#9E9E9E',
        },
        // Posture banner colors from PRD Section 5.4
        posture: {
          buy: '#1B5E20',
          sell: '#B71C1C',
          caution: '#E65100',
          neutral: '#455A64',
          insufficient: '#212121',
        },
        // Header navy from PRD Section 5.1
        navy: {
          DEFAULT: '#1a2744',
          dark: '#0f172a',
        },
      },
    },
  },
  plugins: [],
};

export default config;
