import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported as isAnalyticsSupported } from "firebase/analytics";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";
import { getMessaging, isSupported as isMessagingSupported } from "firebase/messaging";

export const firebaseConfig = {
  apiKey: "AIzaSyAYwUn5GbmrjgPTRHsy2mVWeK3OnMLE5ms",
  authDomain: "rcdemo-ce803.firebaseapp.com",
  projectId: "rcdemo-ce803",
  storageBucket: "rcdemo-ce803.firebasestorage.app",
  messagingSenderId: "712083751615",
  appId: "1:712083751615:web:605fb02eec095669cb7c0a",
  measurementId: "G-KB5ZX5WDXE",
};

export const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
export const auth = getAuth(app);

// Analytics is optional and only available in supported environments (browser HTTPS)
export const analyticsPromise = isAnalyticsSupported()
  .then(supported => (supported ? getAnalytics(app) : null))
  .catch(() => null);

const signUpEndpoint = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`;

interface FirebaseSignUpResponse {
  localId: string;
  email: string;
}

interface FirebaseErrorResponse {
  error?: {
    message?: string;
  };
}

export const createFirebaseAuthUser = async (email: string, password: string): Promise<string> => {
  const response = await fetch(signUpEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password, returnSecureToken: false }),
  });

  const data = (await response.json()) as FirebaseSignUpResponse & FirebaseErrorResponse;

  if (!response.ok) {
    const message = data?.error?.message ?? "Failed to create Firebase auth user";
    throw new Error(message);
  }

  return data.localId;
};

export const messagingPromise = isMessagingSupported()
  .then(supported => (supported ? getMessaging(app) : null))
  .catch(() => null);
