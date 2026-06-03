import React, { useEffect, useRef } from "react";
import { Modal, View, Text, Platform } from "react-native";
import { WebView } from "react-native-webview";
import { SafeAreaView } from "react-native-safe-area-context";
import AnimatedPressable from "@/components/AnimatedPressable";
import { X } from "lucide-react-native";

// Native: window.ReactNativeWebView 주입 타이밍에 의존하지 않도록
// URL scheme 인터셉션 방식 사용 (window.location.href → onShouldStartLoadWithRequest)
const buildNativeHtml = (): string => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>* { margin:0; padding:0; box-sizing:border-box; } html,body,#wrap { width:100%; height:100%; overflow:hidden; }</style>
</head>
<body>
  <div id="wrap"></div>
  <script src="https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"></script>
  <script>
    var _selected = false;
    new daum.Postcode({
      oncomplete: function(data) {
        _selected = true;
        window.location.href = 'rn-bridge://address?addr=' + encodeURIComponent(data.address);
      },
      onclose: function() {
        if (!_selected) window.location.href = 'rn-bridge://close';
      },
      width: '100%', height: '100%',
    }).embed(document.getElementById('wrap'));
  </script>
</body>
</html>`;

// Web iframe: window.parent.postMessage 방식
const buildWebHtml = (): string => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>* { margin:0; padding:0; box-sizing:border-box; } html,body,#wrap { width:100%; height:100%; overflow:hidden; }</style>
</head>
<body>
  <div id="wrap"></div>
  <script src="https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"></script>
  <script>
    var _selected = false;
    new daum.Postcode({
      oncomplete: function(data) {
        _selected = true;
        window.parent.postMessage(JSON.stringify({ type: 'address', address: data.address }), '*');
      },
      onclose: function() {
        if (!_selected) window.parent.postMessage(JSON.stringify({ type: 'close' }), '*');
      },
      width: '100%', height: '100%',
    }).embed(document.getElementById('wrap'));
  </script>
</body>
</html>`;

export interface AddressCoords { lat: number; lng: number; }

interface Props {
  visible: boolean;
  onSelect: (address: string, coords?: AddressCoords) => void;
  onClose: () => void;
  kakaoKey?: string;
}

const HEADER_H = 53;

const KakaoAddressModal: React.FC<Props> = ({ visible, onSelect, onClose }) => {
  const onSelectRef = useRef(onSelect);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // 웹: <iframe srcdoc> + window.message 수신
  useEffect(() => {
    if (Platform.OS !== "web" || !visible) return;

    const overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;background:#fff;";

    const iframe = document.createElement("iframe");
    iframe.style.cssText =
      `position:absolute;top:${HEADER_H}px;left:0;right:0;bottom:0;` +
      `width:100%;height:calc(100% - ${HEADER_H}px);border:none;`;
    iframe.srcdoc = buildWebHtml();

    const destroy = () => {
      if (document.body.contains(overlay)) document.body.removeChild(overlay);
      window.removeEventListener("message", handler);
    };

    const handler = (e: MessageEvent) => {
      if (e.source !== iframe.contentWindow) return;
      try {
        const msg = JSON.parse(e.data as string);
        if (msg.type === "address") {
          destroy();
          onSelectRef.current(msg.address, undefined);
          onCloseRef.current();
        } else if (msg.type === "close") {
          destroy();
          onCloseRef.current();
        }
      } catch {}
    };
    window.addEventListener("message", handler);

    const header = document.createElement("div");
    header.style.cssText =
      `position:absolute;top:0;left:0;right:0;height:${HEADER_H}px;` +
      "display:flex;align-items:center;padding:0 16px;" +
      "border-bottom:1px solid #EBEBEB;box-sizing:border-box;background:#fff;";
    const title = document.createElement("span");
    title.textContent = "주소 검색";
    title.style.cssText =
      "flex:1;font-size:17px;font-weight:700;color:#19191B;font-family:sans-serif;";
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "✕";
    closeBtn.style.cssText =
      "border:none;background:none;font-size:20px;cursor:pointer;color:#70737B;padding:4px 8px;";
    closeBtn.onclick = () => { destroy(); onCloseRef.current(); };
    header.appendChild(title);
    header.appendChild(closeBtn);

    overlay.appendChild(header);
    overlay.appendChild(iframe);
    document.body.appendChild(overlay);

    return destroy;
  }, [visible]);

  if (Platform.OS === "web") return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
        <View style={{
          flexDirection: "row", alignItems: "center",
          paddingHorizontal: 16, paddingVertical: 14,
          borderBottomWidth: 1, borderBottomColor: "#EBEBEB",
        }}>
          <Text style={{ flex: 1, fontSize: 17, fontWeight: "700", color: "#19191B" }}>주소 검색</Text>
          <AnimatedPressable onPress={onClose} scaleAmount={0.9} opacityAmount={0.7} hitSlop={12}>
            <X size={22} color="#70737B" />
          </AnimatedPressable>
        </View>
        <WebView
          source={{ html: buildNativeHtml(), baseUrl: "http://localhost" }}
          style={{ flex: 1 }}
          originWhitelist={["*"]}
          javaScriptEnabled
          domStorageEnabled
          onShouldStartLoadWithRequest={(req) => {
            if (req.url.startsWith("rn-bridge://address")) {
              const addr = decodeURIComponent(req.url.split("addr=")[1] ?? "");
              if (addr) {
                onSelect(addr, undefined);
                onClose();
              }
              return false;
            }
            if (req.url.startsWith("rn-bridge://close")) {
              onClose();
              return false;
            }
            return true;
          }}
        />
      </SafeAreaView>
    </Modal>
  );
};

export default KakaoAddressModal;
