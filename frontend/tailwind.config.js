/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        sea: {
          50: "#eef7ff",
          100: "#d9edff",
          500: "#0f6fb8",
          600: "#0b5a94",
          700: "#0a4a79",
          900: "#08304f",
        },
        leaf: {
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
        },
      },
    },
  },
  plugins: [],
};
