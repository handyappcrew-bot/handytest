import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

const ok = Platform.OS !== "web";

export const hapticLight    = () => { if (ok) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };
export const hapticMedium   = () => { if (ok) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); };
export const hapticHeavy    = () => { if (ok) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); };
export const hapticSuccess  = () => { if (ok) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); };
export const hapticWarning  = () => { if (ok) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); };
export const hapticError    = () => { if (ok) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); };
export const hapticSelection = () => { if (ok) Haptics.selectionAsync(); };
