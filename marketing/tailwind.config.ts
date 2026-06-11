import type { Config } from "tailwindcss";

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0F1E30',
        surface: '#1C3654',
        accent: '#2E6BA8',
        text: '#F9F8F5',
        'text-2': 'rgba(249,248,245,0.75)',
        border: 'rgba(255,255,255,0.08)',
      },
      fontFamily: {
        lora: ['var(--font-lora)', 'serif'],
        jost: ['var(--font-jost)', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
