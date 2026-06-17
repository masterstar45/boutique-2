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

    // Le sessionId doit toujours être un UUID aléatoire imprévisible.
    // On ne le dérive JAMAIS du chatId (chatId Telegram est semi-public).
    // On regénère si la valeur stockée suit l'ancien schéma session_tg_* prévisible.
    let sid: string;
    const stored = localStorage.getItem("cart_session_id");
    if (stored && !stored.startsWith("session_tg_")) {
      sid = stored;
    } else {
      sid = generateSessionId();
      localStorage.setItem("cart_session_id", sid);
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
