import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { subscribeToRealtimeUpdates } from "./lib/localStorage";

const unsubscribeRealtime = subscribeToRealtimeUpdates();

if (import.meta.hot) {
	import.meta.hot.dispose(() => {
		unsubscribeRealtime();
	});
}

createRoot(document.getElementById("root")!).render(<App />);
