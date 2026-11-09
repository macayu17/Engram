import type { Config } from "tailwindcss";

const token = (name: string) => `oklch(var(--color-${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  future: { hoverOnlyWhenSupported: true },
  theme: {
    extend: {
      borderRadius: { lg: "4px", xl: "4px", "2xl": "6px", "3xl": "6px" },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      colors: Object.fromEntries(
        ["paper", "ink", "panel", "muted", "line", "tag", "signal", "caution", "fault", "high"].map((name) => [name, token(name)]),
      ),
    },
  },
  plugins: [],
};

export default config;
