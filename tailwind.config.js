/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#07080c",
        panel: "#10141c",
        line: "#1e2633",
        lime: "#c8f542",
        electric: "#3d8bff"
      },
      fontFamily: {
        display: ["Syne", "sans-serif"],
        sans: ["Outfit", "sans-serif"]
      },
      boxShadow: {
        glow: "0 0 40px rgba(200, 245, 66, 0.18)",
        blue: "0 0 40px rgba(61, 139, 255, 0.2)"
      }
    }
  },
  plugins: []
};
