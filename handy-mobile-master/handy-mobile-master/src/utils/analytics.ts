import analytics from "@react-native-firebase/analytics";

export const logScreen = (screenName: string) =>
  analytics().logScreenView({ screen_name: screenName, screen_class: screenName });

export const logEvent = (name: string, params?: Record<string, any>) =>
  analytics().logEvent(name, params);

export const logLogin = (method: string) =>
  analytics().logLogin({ method });

export const logSignUp = (method: string) =>
  analytics().logSignUp({ method });
