import { useState, useEffect } from 'react';

function generateSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `session_${crypto.randomUUID().replace(/-/g, "")}`;
  }

  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `session_${hex}`;
  }

  return `session_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function useSession() {
  const [sessionId, setSessionId] = useState<string>("");
  const [chatId, setChatId] = useState<string>("");
  const [username, setUsername] = useState<string>("");

  useEffect(() => {
    const cid = localStorage.getItem("telegram_chat_id");

    // Quand l'utilisateur est authentifié, on dérive le sessionId de son chatId
    // afin que deux utilisateurs sur le même appareil n'aient pas le même panier
    let sid: string;
    if (cid) {
      sid = `session_tg_${cid}`;
      localStorage.setItem("cart_session_id", sid);
    } else {
      const stored = localStorage.getItem("cart_session_id");
      // Ne pas réutiliser un session lié à un autre compte
      if (!stored || stored.startsWith("session_tg_")) {
        sid = generateSessionId();
        localStorage.setItem("cart_session_id", sid);
      } else {
        sid = stored;
      }
    }
    setSessionId(sid);

    if (cid) setChatId(cid);

    const uname = localStorage.getItem("telegram_username");
    if (uname) setUsername(uname);
  }, []);

  const saveChatId = (id: string) => {
    localStorage.setItem("telegram_chat_id", id);
    setChatId(id);
  };

  const saveUsername = (uname: string) => {
    localStorage.setItem("telegram_username", uname);
    setUsername(uname);
  };

  const clearChatId = () => {
    localStorage.removeItem("telegram_chat_id");
    localStorage.removeItem("telegram_username");
    setChatId("");
    setUsername("");
  };

  return { sessionId, chatId, username, saveChatId, saveUsername, clearChatId };
}
