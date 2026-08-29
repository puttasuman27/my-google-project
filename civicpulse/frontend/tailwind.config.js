/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        civic: {
          deep: '#0B4D3C',      // Header & Navigation Forest Green
          primary: '#047857',   // Primary Emerald
          mint: '#10B981',      // Verification & Success Accent
          orange: '#F97316',    // High-Priority & CTA Tangerine
          canvas: '#F4F8F6',    // Soft Off-White Background
          card: '#FFFFFF',      // Card Surfaces
          danger: '#EF4444',    // SLA Breach / High Severity
        }
      },
      borderRadius: {
        'card': '28px',
      },
      boxShadow: {
        'civic': '0 12px 30px -8px rgba(11, 77, 60, 0.10)',
        'floating': '0 20px 40px -12px rgba(249, 115, 22, 0.25)'
      }
    },
  },
  plugins: [],
}