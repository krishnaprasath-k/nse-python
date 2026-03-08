/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#3A2E7D',
          accent: '#EFB41D',
          link: '#EFB41D',
          bg: '#FFFFFF',
          text: '#000000'
        }
      },
      fontFamily: {
        poppins: ['Poppins', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '5px'
      }
    },
  },
  plugins: [],
}
