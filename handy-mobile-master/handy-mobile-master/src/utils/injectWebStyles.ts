import { Platform } from "react-native";

/**
 * 웹에서만 적용되는 최소 CSS 주입.
 * body/root 레이아웃은 절대 건드리지 않음 — RN Web 내부 flex 구조를 보존해야 함.
 */
export function injectWebStyles(): void {
  if (Platform.OS !== "web") return;
  if (typeof document === "undefined") return;

  // Pretendard 폰트 CDN
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css";
  document.head.appendChild(link);

  const style = document.createElement("style");
  style.textContent = `
    /* ── Pretendard 전체 적용 ────────────────────────────── */
    * { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important; }

    /* ── 입력 브라우저 기본 outline 제거 ─────────────────── */
    input, textarea, select {
      outline: none !important;
      box-shadow: none !important;
      -webkit-appearance: none;
      -moz-appearance: none;
    }

    /* ── 스크롤바 숨김 ───────────────────────────────────── */
    *::-webkit-scrollbar { display: none !important; }
    * { scrollbar-width: none !important; -ms-overflow-style: none !important; }

    /* ── Pressable div 커서 ─────────────────────────────── */
    [role="button"] { cursor: pointer !important; }

    /* ── 터치 하이라이트 제거 ───────────────────────────── */
    * { -webkit-tap-highlight-color: transparent !important; }

    /* ── 페이지 가로 스크롤 방지 ────────────────────────── */
    html, body { overflow-x: hidden !important; }

    /* ── 브라우저 기본 비밀번호 reveal 버튼 제거 ─────── */
    input[type="password"]::-ms-reveal,
    input[type="password"]::-ms-clear { display: none !important; }
    input::-webkit-credentials-auto-fill-button,
    input::-webkit-strong-password-auto-fill-button { display: none !important; }
  `;
  document.head.appendChild(style);
}
