/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./App.tsx"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // 디자인 시스템 (web 프론트와 동일)
        primary: "#4261FF",
        "primary-light": "#E8F3FF",
        "text-strong": "#19191B",
        "text-default": "#292B2E",
        "text-muted": "#70737B",
        "text-soft": "#9EA3AD",
        "text-disabled": "#AAB4BF",
        border: "#DBDCDF",
        "border-light": "#F0F0F0",
        "bg-soft": "#F7F7F8",
        success: "#1EDC83",
        danger: "#FF3D3D",
        warning: "#FFB300",
        // shift 색상
        "shift-open-bg": "#FDF9DF",
        "shift-open": "#FFB300",
        "shift-middle-bg": "#ECFFF1",
        "shift-middle": "#1EDC83",
        "shift-close-bg": "#E8F9FF",
        "shift-close": "#14C1FA",
      },
      fontFamily: {
        pretendard: ["Pretendard"],
      },
    },
  },
  plugins: [],
};
