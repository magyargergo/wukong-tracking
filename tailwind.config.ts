import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      container: {
        center: true,
        padding: {
          DEFAULT: "1rem",
          sm: "1rem",
          lg: "2rem",
          xl: "2.5rem",
          "2xl": "3rem",
        },
      },
      colors: {
        accent: {
          DEFAULT: "#d1a954",
        }
      },
      borderRadius: {
        lg: "0.75rem",
        xl: "1rem",
        "2xl": "1.25rem",
      },
      boxShadow: {
        sm: "0 1px 2px 0 rgba(0,0,0,0.04)",
        md: "0 6px 12px rgba(0,0,0,0.06)",
        lg: "0 10px 20px rgba(0,0,0,0.08)",
      },
      transitionDuration: {
        150: "150ms",
        200: "200ms",
      }
    }
  },
  plugins: []
};
export default config;


