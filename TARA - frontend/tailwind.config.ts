import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#131521",
        cloud: "#f8f6ef",
        ember: "#cf5e39",
        ocean: "#1e4f74",
        mint: "#75b798",
      },
      boxShadow: {
        panel: "0 14px 40px rgba(19, 21, 33, 0.08)",
      },
      backgroundImage: {
        "sunrise-grid":
          "radial-gradient(circle at 18% 12%, rgba(207,94,57,0.14), transparent 38%), radial-gradient(circle at 82% 0%, rgba(30,79,116,0.16), transparent 32%), linear-gradient(135deg, #f8f6ef 0%, #f1eee5 100%)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-left": {
          "0%": { opacity: "0", transform: "translateX(-10px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.25s ease-out both",
        "slide-up": "slide-up 0.3s ease-out both",
        "slide-in-left": "slide-in-left 0.22s ease-out both",
        "scale-in": "scale-in 0.15s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
