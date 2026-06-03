import { Platform } from "react-native";

/**
 * 다음(카카오) 우편번호 API를 열어 주소를 선택하게 합니다.
 * 웹 플랫폼에서만 동작하며, 스크립트를 동적으로 로드합니다.
 */
export function openDaumPostcode(onSelect: (address: string) => void): void {
  if (Platform.OS !== "web") return;

  const launch = () => {
    new (window as any).daum.Postcode({
      oncomplete: (data: { address: string }) => {
        onSelect(data.address);
      },
    }).open();
  };

  if ((window as any).daum?.Postcode) {
    launch();
  } else {
    const script = document.createElement("script");
    script.src = "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
    script.onload = launch;
    document.head.appendChild(script);
  }
}
