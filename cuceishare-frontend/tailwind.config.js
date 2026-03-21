/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f3f7fc',
          100: '#e6eff8',
          200: '#c8ddef',
          300: '#98bfe1',
          400: '#619ecf',
          500: '#397aaf',
          600: '#2c679d',
          700: '#25537f',
          800: '#22476a',
          900: '#213c59',
          950: '#16273b',
        },
        // Al sobreescribir 'indigo', se aplicará instantáneamente en todos los componentes que lo usen
        indigo: {
          50: '#f3f7fc',
          100: '#e6eff8',
          200: '#c8ddef',
          300: '#98bfe1',
          400: '#619ecf',
          500: '#397aaf',
          600: '#2c679d',
          700: '#25537f',
          800: '#22476a',
          900: '#213c59',
          950: '#16273b',
        },
      },
    },
  },
  plugins: [],
}
