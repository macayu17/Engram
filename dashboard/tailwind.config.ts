import type { Config } from "tailwindcss";

const token = (name: string) => `oklch(var(--color-${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  future: { hoverOnlyWhenSupported: true },
  theme: {
    extend: {
      borderRadius: { sm: "var(--radius-sm)", md: "var(--radius-md)", lg: "var(--radius-lg)", xl: "var(--radius-lg)", "2xl": "var(--radius-lg)", "3xl": "var(--radius-lg)" },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        display: ["var(--font-display)", "Iowan Old Style", "Georgia", "serif"],
      },
      colors: Object.fromEntries(
        [
          "paper", "card", "ink", "ink-muted", "line", "hot", "hot-ink", "hot-fill", "on-hot", "button", "on-button", "tint",
          "scene", "scene-line", "scene-dim", "scene-muted", "scene-ink", "scene-hot", "approved", "forgotten", "caution",
          "panel", "muted", "tag", "signal", "high", "fault",
        ].map((name) => [name, token(name)]),
      ),
      animation: {
        "trace-draw": "trace-draw 3.6s cubic-bezier(0.23, 1, 0.32, 1) infinite",
        "trace-hit": "trace-hit 3.6s cubic-bezier(0.23, 1, 0.32, 1) infinite",
        rise: "rise 0.4s cubic-bezier(0.23, 1, 0.32, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;
