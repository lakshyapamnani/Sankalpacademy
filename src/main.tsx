import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { subscribeToRealtimeUpdates } from "./lib/localStorage";
import { listenForForegroundMessages } from "./lib/messaging";

const unsubscribeRealtime = subscribeToRealtimeUpdates();

// Detect native environments (Electron desktop or Capacitor mobile)
const isElectron = typeof window !== 'undefined' && (navigator.userAgent.includes('Electron') || !!(window as any).electronAPI);
const isCapacitor = typeof window !== 'undefined' && (!!(window as any).Capacitor || window.location.protocol === 'capacitor:');
const isNativeApp = isElectron || isCapacitor;

// On Native apps (Capacitor/Electron), unregister any active service worker and clear cache
// so Android WebView always loads the latest compiled app bundle instead of stale cached assets.
if (isNativeApp && typeof navigator !== 'undefined' && "serviceWorker" in navigator) {
	navigator.serviceWorker.getRegistrations().then(registrations => {
		for (const registration of registrations) {
			registration.unregister();
		}
	});
	if (typeof caches !== 'undefined') {
		caches.keys().then(keys => keys.forEach(key => caches.delete(key)));
	}
}

if (!isNativeApp && "serviceWorker" in navigator) {
	navigator.serviceWorker
		.register("/firebase-messaging-sw.js")
		.catch(error => {
			console.error("Failed to register Firebase messaging service worker", error);
		});
	navigator.serviceWorker.register('/sw.js').catch(err => {
		console.error('Failed to register service worker', err);
	});
}

// Firebase foreground messaging relies on service workers — skip on native desktop
if (!isElectron) {
	listenForForegroundMessages();
}

if (import.meta.hot) {
	import.meta.hot.dispose(() => {
		unsubscribeRealtime();
	});
}

createRoot(document.getElementById("root")!).render(<App />);
