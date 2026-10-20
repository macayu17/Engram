import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-archivo)", "system-ui", "sans-serif"],
        serif: ["var(--font-newsreader)", "Georgia", "serif"],
        sans: ["var(--font-geist)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        paper: "rgb(var(--color-paper) / <alpha-value>)",
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        panel: "rgb(var(--color-panel) / <alpha-value>)",
        muted: "rgb(var(--color-muted) / <alpha-value>)",
        line: "rgb(var(--color-line) / <alpha-value>)",
        tag: "rgb(var(--color-tag) / <alpha-value>)",
        signal: "rgb(var(--color-signal) / <alpha-value>)",
        caution: "rgb(var(--color-caution) / <alpha-value>)",
        fault: "rgb(var(--color-fault) / <alpha-value>)",
        high: "rgb(var(--color-high) / <alpha-value>)",
        lp: "rgb(var(--lp) / <alpha-value>)",
        li: "rgb(var(--li) / <alpha-value>)",
        ll: "rgb(var(--ll) / <alpha-value>)",
        lm: "rgb(var(--lm) / <alpha-value>)",
        lsignal: "rgb(var(--lsignal) / <alpha-value>)",
      },
    },
  },
  plugins: [],
};

export default config;
