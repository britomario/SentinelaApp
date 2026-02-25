/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.tsx',
    './src/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './screens/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Design System Sentinela
        surface: '#F9FAFB',
        'surface-card': '#FFFFFF',
        primary: '#2563EB',
        'primary-soft': '#4F46E5',
        alert: '#EF4444',
        'alert-soft': '#F97316',
        success: '#10B981',
        muted: '#9CA3AF',
        'text-primary': '#111827',
        'text-secondary': '#6B7280',
      },
      fontFamily: {
        sans: ['System'],
      },
    },
  },
  plugins: [],
};
