/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./index.customer.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // FLYP Official Brand Colors
        'flyp': {
          'green': '#05E06C',        // Primary brand green
          'green-light': '#2EF58A',  // Lighter variant
          'green-dark': '#04B857',   // Darker variant
          'navy': '#060D2D',         // Primary dark background
          'navy-light': '#0A1340',   // Slightly lighter
          'navy-medium': '#101B4A',  // Card backgrounds
          'navy-accent': '#1A2556',  // Accent/borders
        }
      },
      screens: {
        'xs': '375px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
      minHeight: {
        'touch': '44px',
        'touch-lg': '48px',
      },
      minWidth: {
        'touch': '44px',
        'touch-lg': '48px',
      },
    },
  },
  plugins: [],
}
