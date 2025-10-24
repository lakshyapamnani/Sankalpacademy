import { getToken, onMessage } from "firebase/messaging";
import { toast } from "sonner";
import { messagingPromise } from "./firebase";
import { saveNotificationToken } from "./localStorage";

type NotificationRole = "teacher" | "student";

interface RegisterOptions {
  batchId?: string;
}

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

const ensureVapidKey = () => {
  if (!vapidKey) {
    throw new Error("Missing VITE_FIREBASE_VAPID_KEY environment variable");
  }
  return vapidKey;
};

export const registerForPushNotifications = async (
  role: NotificationRole,
  referenceId: string,
  options: RegisterOptions = {},
): Promise<string | null> => {
  if (!referenceId) {
    return null;
  }

  const messaging = await messagingPromise;
  if (!messaging) {
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return null;
  }

  try {
    const token = await getToken(messaging, { vapidKey: ensureVapidKey(), serviceWorkerRegistration: await navigator.serviceWorker.ready });
    if (token) {
      await saveNotificationToken(role, referenceId, token, options);
      return token;
    }
    return null;
  } catch (error) {
    console.error("Failed to register for push notifications", error);
    return null;
  }
};

export const listenForForegroundMessages = () => {
  void messagingPromise.then(messaging => {
    if (!messaging) {
      return;
    }

    onMessage(messaging, payload => {
      const { title, body } = payload.notification ?? {};
      if (!title) {
        return;
      }

      toast.info(title, {
        description: body,
      });
    });
  });
};
