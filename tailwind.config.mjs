/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
        // Cyberpunk neon theme colors
        primary: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          200: "#bae6fd",
          300: "#7dd3fc",
          400: "#38bdf8",
          500: "#0ea5e9",
          600: "#0284c7",
          700: "#0369a1",
          800: "#075985",
          900: "#0c4a6e",
        },
        neon: {
          cyan: "#00ffff",
          pink: "#ff00ff",
          green: "#00ff00",
          purple: "#9d4edd",
          yellow: "#ffff00",
          blue: "#0099ff",
        },
        dark: {
          bg: "#0a0a0a",
          surface: "#1a1a2e",
          card: "#16213e",
          900: "#0a0a0a",
          800: "#1a1a1a",
          700: "#2a2a2a",
          600: "#3a3a3a",
          500: "#4a4a4a",
        },
        text: {
          primary: "#ffffff",
          secondary: "#b0b0b0",
          muted: "#666666",
        },
        success: "#00ff88",
        error: "#ff0066",
        warning: "#ffaa00",
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Monaco", "Consolas", "monospace"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      animation: {
        "pulse-neon": "pulse-neon 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow": "glow 2s ease-in-out infinite alternate",
        "slide-up": "slide-up 0.3s ease-out",
        "fade-in": "fade-in 0.5s ease-in",
      },
      keyframes: {
        "pulse-neon": {
          "0%, 100%": {
            opacity: "1",
            filter: "drop-shadow(0 0 10px currentColor)",
          },
          "50%": {
            opacity: "0.7",
            filter: "drop-shadow(0 0 20px currentColor)",
          },
        },
        glow: {
          from: {
            "box-shadow": "0 0 20px currentColor",
          },
          to: {
            "box-shadow": "0 0 30px currentColor, 0 0 40px currentColor",
          },
        },
        "slide-up": {
          from: {
            opacity: "0",
            transform: "translateY(20px)",
          },
          to: {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "grid-pattern": "url('data:image/svg+xml,%3csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\" width=\"32\" height=\"32\" fill=\"none\" stroke=\"%23ffffff10\"%3e%3cpath d=\"m0 .5 32 0M.5 0v32M31.5 0v32M0 31.5l32 0\"/%3e%3c/svg%3e')",
      },
      spacing: {
        18: "4.5rem",
        88: "22rem",
        128: "32rem",
      },
      boxShadow: {
        neon: "0 0 20px currentColor",
        "neon-lg": "0 0 30px currentColor, 0 0 60px currentColor",
        glass: "0 8px 32px 0 rgba(31, 38, 135, 0.37)",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};