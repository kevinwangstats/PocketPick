/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./index.ts",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#000000",
          card: "#18181B",
          subtle: "#27272A",
          border: "#3F3F46",
          light: "#FFFFFF",
          "card-light": "#F4F4F5",
          "border-light": "#E4E4E7",
        },
        monochrome: {
          black: "#000000",
          white: "#FFFFFF",
          900: "#18181B",
          800: "#27272A",
          700: "#3F3F46",
          600: "#52525B",
          500: "#71717A",
          400: "#A1A1AA",
          300: "#D4D4D8",
          200: "#E4E4E7",
          100: "#F4F4F5",
          50: "#FAFAFA",
        },
      },
      fontFamily: {
        mono: ["Courier", "Menlo", "monospace"],
      },
      borderRadius: {
        none: "0px",
        sm: "2px",
      },
    },
  },
  plugins: [],
};
