import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./features/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#152033",
        sea: "#157a6e",
        amber: "#f2994a",
        mist: "#ecf4f6",
        "brand-orange": "#157a6e",
        "brand-dark": "#152033",
        "brand-light": "#f2f8f9"
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        serif: ["Libre Baskerville", "Georgia", "serif"],
        mono: ["JetBrains Mono", "SFMono-Regular", "monospace"]
      },
      boxShadow: {
        soft: "0 18px 45px -26px rgba(21, 32, 51, 0.45)"
      }
    }
  },
  plugins: [typography]
};

export default config;
