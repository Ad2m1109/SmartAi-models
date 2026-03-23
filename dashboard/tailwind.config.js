import typography from '@tailwindcss/typography';

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
          lime: "#9FC401",
          "lime-light": "#B8E600",
          navy: "#111827",
          "gray-bg": "#F5F7FA",
          "indigo-glow": "#4F46E5",
        },
        status: {
          success: "#22C55E",
          warning: "#F59E0B",
          error: "#EF4444",
        },
        text: {
          primary: "#111827",
          secondary: "#6B7280",
        }
      },
      borderRadius: {
        'soft': '16px',
        'soft-xl': '24px',
        'pill': '9999px',
      },
      boxShadow: {
        'soft': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
        'glow': '0 0 20px -5px rgba(79, 70, 229, 0.15)',
        'glow-hover': '0 0 30px -5px rgba(79, 70, 229, 0.25)',
      }
    },
  },
  plugins: [typography],
}
