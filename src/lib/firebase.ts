import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported as isAnalyticsSupported } from "firebase/analytics";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";
import { getMessaging, isSupported as isMessagingSupported } from "firebase/messaging";

export const firebaseConfig = {
  apiKey: "AIzaSyDF3rJgsecEClcC6Qm9ziVaDvGV5a8BWE8",
  authDomain: "sankalpacademy-4c3c4.firebaseapp.com",
  projectId: "sankalpacademy-4c3c4",
  storageBucket: "sankalpacademy-4c3c4.firebasestorage.app",
  messagingSenderId: "235601051753",
  appId: "1:235601051753:web:7e1ac1b1721093072622f8",
  measurementId: "G-233Z080D73",
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
