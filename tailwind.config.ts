import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        court: {
          hard: "#3b82f6",
          clay: "#d97706",
          grass: "#16a34a",
        },
      },
    },
  },
  plugins: [],
};

export default config;
