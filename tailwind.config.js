/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        // 工作室深色调色板（与 iOS 版 studioGrey 对齐）
        studio: {
          black: "#0E0E10",      // 视口背景
          dark: "#1A1A1E",       // 工具栏底色
          panel: "#2A2A2E",      // 卡片
          border: "#3A3A3E",     // 边框
          muted: "#5A5A5E",      // 次级文字
          light: "#8A8A8E",      // 三级文字
        },
        // 强调与状态色
        accent: {
          film: "#FF8A3D",       // 胶片橙（主 CTA + 录制点）
          select: "#4A9EFF",     // 选中态冷蓝
        },
        status: {
          rec: "#FF3B30",        // 录制红
          ok: "#30D158",         // 成功绿
          warn: "#FFD60A",       // 警告黄
        },
      },
      fontFamily: {
        display: ['"Space Mono"', "monospace"],
        sans: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      backdropBlur: {
        glass: "20px",
      },
      boxShadow: {
        glass: "0 8px 32px rgba(0, 0, 0, 0.45)",
        float: "0 4px 16px rgba(0, 0, 0, 0.25)",
      },
      animation: {
        "rec-pulse": "rec-pulse 1.2s ease-in-out infinite",
        "slide-down": "slide-down 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
        "fade-in": "fade-in 0.3s ease-out",
      },
      keyframes: {
        "rec-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.3" },
        },
        "slide-down": {
          "0%": { transform: "translateY(-100%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
