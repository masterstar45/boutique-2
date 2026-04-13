import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const originalFetch = window.fetch.bind(window);

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
	const tg = (window as any).Telegram?.WebApp;
	const initData = tg?.initData;

	if (!initData || initData.length === 0) {
		return originalFetch(input, init);
	}

	const request = new Request(input, init);
	const headers = new Headers(request.headers);

	if (!headers.has("x-telegram-init-data")) {
		headers.set("x-telegram-init-data", initData);
	}

	return originalFetch(request, { ...init, headers });
};

createRoot(document.getElementById("root")!).render(<App />);
