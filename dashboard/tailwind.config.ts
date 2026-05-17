import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FBFBF9",
        ink: "#1A1A18",
        panel: "#FFFFFF",
        muted: "#6B6B63",
        line: "#E5E5DF",
        tag: "#F0F0EA",
        signal: "#C96A1A",
        caution: "#8B6F2D",
        fault: "#B42318",
      },
    },
  },
  plugins: [],
};

export default config;
