/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/10.13.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDF3rJgsecEClcC6Qm9ziVaDvGV5a8BWE8",
  authDomain: "sankalpacademy-4c3c4.firebaseapp.com",
  projectId: "sankalpacademy-4c3c4",
  storageBucket: "sankalpacademy-4c3c4.firebasestorage.app",
  messagingSenderId: "235601051753",
  appId: "1:235601051753:web:7e1ac1b1721093072622f8",
  measurementId: "G-233Z080D73",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const notification = payload.notification ?? {};
  const title = notification.title || "New Notification";
  const options = {
    body: notification.body,
    icon: notification.icon,
    data: payload.data,
  };

  self.registration.showNotification(title, options);
});
