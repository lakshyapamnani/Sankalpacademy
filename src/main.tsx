import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { subscribeToRealtimeUpdates } from "./lib/localStorage";
import { listenForForegroundMessages } from "./lib/messaging";

const unsubscribeRealtime = subscribeToRealtimeUpdates();

if ("serviceWorker" in navigator) {
	navigator.serviceWorker
		.register("/firebase-messaging-sw.js")
		.catch(error => {
			console.error("Failed to register Firebase messaging service worker", error);
		});
}

listenForForegroundMessages();

if ("serviceWorker" in navigator) {
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
