import type { Config } from "tailwindcss";

// neon = acento principal, volt = acento secundario, blaze = en vivo / alerta, pitch = superficies
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Todos los colores salen de variables CSS: cada tema (data-theme en <html>) las redefine en globals.css
      colors: {
        white: "rgb(var(--ink) / <alpha-value>)",
        onaccent: "rgb(var(--onaccent) / <alpha-value>)",
        pitch: { 950: "rgb(var(--s950) / <alpha-value>)", 900: "rgb(var(--s900) / <alpha-value>)", 800: "rgb(var(--s800) / <alpha-value>)", 700: "rgb(var(--s700) / <alpha-value>)", 600: "rgb(var(--s600) / <alpha-value>)" },
        neon: { DEFAULT: "rgb(var(--accent) / <alpha-value>)", dim: "rgb(var(--accent-dim) / <alpha-value>)" },
        volt: { DEFAULT: "rgb(var(--accent2) / <alpha-value>)", light: "rgb(var(--accent2-light) / <alpha-value>)", deep: "rgb(var(--accent2-deep) / <alpha-value>)" },
        blaze: { DEFAULT: "rgb(var(--live) / <alpha-value>)", light: "rgb(var(--live-light) / <alpha-value>)" },
        amber: { 100: "rgb(var(--amber-100) / <alpha-value>)", 200: "rgb(var(--amber-200) / <alpha-value>)", 300: "rgb(var(--amber-300) / <alpha-value>)", 400: "rgb(var(--amber-400) / <alpha-value>)", 500: "rgb(var(--amber-500) / <alpha-value>)" },
        rose: { 100: "rgb(var(--rose-100) / <alpha-value>)", 200: "rgb(var(--rose-200) / <alpha-value>)", 300: "rgb(var(--rose-300) / <alpha-value>)" },
        red: { 300: "rgb(var(--rose-300) / <alpha-value>)" },
        emerald: { 300: "rgb(var(--good) / <alpha-value>)" },
        sky: { 300: "rgb(var(--info) / <alpha-value>)" },
        orange: { 300: "rgb(var(--orange) / <alpha-value>)" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
      },
      boxShadow: {
        glow: "var(--glow)",
        "glow-neon": "var(--glow-accent)",
      },
      keyframes: {
        pop: { "0%": { transform: "scale(.85)", opacity: "0" }, "100%": { transform: "scale(1)", opacity: "1" } },
        flash: { "0%": { backgroundColor: "rgb(var(--accent) / .3)" }, "100%": { backgroundColor: "transparent" } },
        slideUp: { "0%": { transform: "translateY(12px)", opacity: "0" }, "100%": { transform: "translateY(0)", opacity: "1" } },
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        pulseGlow: { "0%,100%": { opacity: "1" }, "50%": { opacity: ".45" } },
      },
      animation: {
        pop: "pop .25s cubic-bezier(.2,.9,.3,1.2)",
        flash: "flash 1.2s ease-out",
        slideUp: "slideUp .3s cubic-bezier(.2,.8,.2,1)",
        shimmer: "shimmer 1.6s linear infinite",
        pulseGlow: "pulseGlow 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
