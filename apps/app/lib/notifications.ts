import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "./api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const base64ToUint8Array = (value: string) => {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replaceAll("-", "+").replaceAll("_", "/");
  const raw = atob(base64);

  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
};

export async function registerDriverNotifications(driverId: string) {
  if (Platform.OS === "web") {
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !process.env.EXPO_PUBLIC_WEB_PUSH_PUBLIC_KEY
    ) {
      return;
    }

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      return;
    }

    const registration = await navigator.serviceWorker.register("/service-worker.js");
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64ToUint8Array(
          process.env.EXPO_PUBLIC_WEB_PUSH_PUBLIC_KEY,
        ),
      }));

    const json = subscription.toJSON();

    if (!json.endpoint || !json.keys?.auth || !json.keys.p256dh) {
      return;
    }

    await api.registerDriverDevice(driverId, {
      platform: "web",
      endpoint: json.endpoint,
      keys: {
        auth: json.keys.auth,
        p256dh: json.keys.p256dh,
      },
    });
    return;
  }

  if (!Device.isDevice) {
    return;
  }

  const permissions = await Notifications.getPermissionsAsync();
  let status = permissions.status;

  if (status !== "granted") {
    const next = await Notifications.requestPermissionsAsync();
    status = next.status;
  }

  if (status !== "granted") {
    return;
  }

  const expoExtra = Constants.expoConfig?.extra as
    | { eas?: { projectId?: string } }
    | undefined;
  const projectId = Constants.easConfig?.projectId ?? expoExtra?.eas?.projectId;

  if (!projectId) {
    return;
  }

  const token = await Notifications.getExpoPushTokenAsync({
    projectId,
  });

  await api.registerDriverDevice(driverId, {
    platform: "expo",
    expoPushToken: token.data,
  });
}
