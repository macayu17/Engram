import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
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
      },
    },
  },
  plugins: [],
};

export default config;
