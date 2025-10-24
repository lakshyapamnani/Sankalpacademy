/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/10.13.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyAYwUn5GbmrjgPTRHsy2mVWeK3OnMLE5ms",
  authDomain: "rcdemo-ce803.firebaseapp.com",
  projectId: "rcdemo-ce803",
  storageBucket: "rcdemo-ce803.firebasestorage.app",
  messagingSenderId: "712083751615",
  appId: "1:712083751615:web:605fb02eec095669cb7c0a",
  measurementId: "G-KB5ZX5WDXE",
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
