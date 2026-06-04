import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { subscribeToRealtimeUpdates } from "./lib/localStorage";
import { listenForForegroundMessages } from "./lib/messaging";

const unsubscribeRealtime = subscribeToRealtimeUpdates();

// Service workers are NOT supported on file:// URLs (Electron desktop mode).
// Only register them when running in a real browser / web context.
const isElectron = navigator.userAgent.includes('Electron');

if (!isElectron && "serviceWorker" in navigator) {
	navigator.serviceWorker
		.register("/firebase-messaging-sw.js")
		.catch(error => {
			console.error("Failed to register Firebase messaging service worker", error);
		});
}

// Firebase foreground messaging also relies on service workers — skip in Electron
if (!isElectron) {
	listenForForegroundMessages();
}

if (!isElectron && "serviceWorker" in navigator) {
	navigator.serviceWorker.register('/sw.js').catch(err => {
		console.error('Failed to register service worker', err);
	});
}

if (import.meta.hot) {
	import.meta.hot.dispose(() => {
		unsubscribeRealtime();
	});
}

createRoot(document.getElementById("root")!).render(<App />);
