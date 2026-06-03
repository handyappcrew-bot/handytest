import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { api } from "@/api/client";
import { localStorage } from "@/utils/storage";

// Called from App.tsx useEffect — must not run at module level (crashes New Arch TurboModule init)
export const initNotificationHandler = (): void => {
  if (Platform.OS === "web") return;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch {}
};

/**
 * Expo push token 발급 + 백엔드에 등록.
 * Expo / FCM 어느쪽 사용할지는 백엔드 RN-4 합의 후 결정.
 * 본 함수는 Expo push token 을 백엔드로 전송 (`POST /api/auth/fcm-token`).
 */
export const updateBadge = async (count: number): Promise<void> => {
  if (Platform.OS === "web") return;
  try { await Notifications.setBadgeCountAsync(Math.max(0, count)); } catch {}
};

export const clearBadge = (): void => { updateBadge(0); };

const CLOCKOUT_REMINDER_KEY = "clockout_reminder_notif_id";

export const scheduleClockOutReminder = async (
  schedEnd: string,
  schedStart: string | null,
): Promise<void> => {
  if (Platform.OS === "web") return;
  try {
    await cancelClockOutReminder();
    const triggerDate = new Date();
    const [eh, em] = schedEnd.split(":").map(Number);
    triggerDate.setHours(eh, em, 0, 0);
    // Night shift: schedEnd is next day
    if (schedEnd < (schedStart ?? "00:00")) triggerDate.setDate(triggerDate.getDate() + 1);
    // +30 min grace period
    triggerDate.setTime(triggerDate.getTime() + 30 * 60 * 1000);
    const seconds = Math.floor((triggerDate.getTime() - Date.now()) / 1000);
    if (seconds <= 0) return;
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "퇴근 확인",
        body: "퇴근 버튼을 눌렀나요? 확인해주세요!",
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        repeats: false,
      },
    });
    localStorage.setItem(CLOCKOUT_REMINDER_KEY, id);
  } catch (err) {
    console.warn("[push] 퇴근 알림 예약 실패:", err);
  }
};

export const cancelClockOutReminder = async (): Promise<void> => {
  if (Platform.OS === "web") return;
  try {
    const id = localStorage.getItem(CLOCKOUT_REMINDER_KEY);
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id);
      localStorage.removeItem(CLOCKOUT_REMINDER_KEY);
    }
  } catch {}
};

export const fireUnclosedShiftNotification = async (workDate: string): Promise<void> => {
  if (Platform.OS === "web") return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "미퇴근 알림",
        body: `${workDate} 근무 퇴근 처리가 되지 않았어요. 앱에서 확인해주세요.`,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1,
        repeats: false,
      },
    });
  } catch (err) {
    console.warn("[push] 미퇴근 알림 실패:", err);
  }
};

export const registerForPushNotifications = async (): Promise<string | null> => {
  if (Platform.OS === "web") return null;
  if (!Device.isDevice) return null;

  // Android 채널 생성
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#4261FF",
    });
  }

  // 권한 확인 + 요청
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;

  try {
    // FCM device token (Firebase Admin SDK가 직접 전송하므로 Expo push token이 아닌 FCM 토큰 필요)
    const { data: token } = await Notifications.getDevicePushTokenAsync();
    try {
      await api.post("/api/auth/fcm-token", { token });
    } catch (err) {
      console.warn("[push] 토큰 등록 실패:", err);
    }
    return token;
  } catch (err) {
    console.warn("[push] 토큰 발급 실패:", err);
    return null;
  }
};
