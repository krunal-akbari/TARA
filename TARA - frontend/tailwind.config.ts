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
    },
  },
  plugins: [],
};

export default config;
