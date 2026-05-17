import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111318",
        panel: "#181b22",
        line: "#2a2f3a",
        signal: "#45d19a",
        caution: "#e6b450",
        fault: "#e05f5f",
      },
      boxShadow: {
        grid: "0 0 0 1px rgba(255,255,255,0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
