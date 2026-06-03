import crashlytics from "@react-native-firebase/crashlytics";

export const recordError = (error: unknown, context?: string) => {
  const err = error instanceof Error ? error : new Error(String(error));
  if (context) crashlytics().log(context);
  crashlytics().recordError(err);
};

export const setUser = (userId: string) =>
  crashlytics().setUserId(userId);

export const log = (message: string) =>
  crashlytics().log(message);
