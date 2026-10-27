import type { Config } from "tailwindcss";

// Estilo esports: fondo violeta casi negro, acento cian eléctrico (neon), violeta (volt) y rosa de acción (blaze)
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pitch: { 950: "#07061a", 900: "#0d0b24", 800: "#15122f", 700: "#1e1a3d", 600: "#2a2552" },
        neon: { DEFAULT: "#2ee6ff", dim: "#06b6d4" },
        volt: { DEFAULT: "#8b5cf6", light: "#a78bfa", deep: "#6d28d9" },
        blaze: { DEFAULT: "#f43f5e", light: "#fb7185" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(167,139,250,.35), 0 8px 30px -8px rgba(139,92,246,.55)",
        "glow-neon": "0 0 0 1px rgba(46,230,255,.4), 0 8px 28px -8px rgba(46,230,255,.5)",
      },
      keyframes: {
        pop: { "0%": { transform: "scale(.85)", opacity: "0" }, "100%": { transform: "scale(1)", opacity: "1" } },
        flash: { "0%": { backgroundColor: "rgba(46,230,255,.3)" }, "100%": { backgroundColor: "transparent" } },
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
