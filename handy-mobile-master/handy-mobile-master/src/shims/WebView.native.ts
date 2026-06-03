import { TurboModuleRegistry, View } from "react-native";

// react-native-webview calls TurboModuleRegistry.getEnforcing at module level.
// getEnforcing throws an uncatchable JSI exception when the native module is absent
// (e.g. Expo Go). Guard with .get() so the require is never evaluated in that case.
const isAvailable = !!TurboModuleRegistry.get("RNCWebViewModule");
const WebView = isAvailable ? (require("react-native-webview").default as any) : View;

export default WebView;
