import { useState, useEffect } from 'react';

export function useSession() {
  const [sessionId, setSessionId] = useState<string>("");
  const [chatId, setChatId] = useState<string>("");

  useEffect(() => {
    let sid = localStorage.getItem("cart_session_id");
    if (!sid) {
      sid = "session_" + Math.random().toString(36).substring(2, 15);
      localStorage.setItem("cart_session_id", sid);
    }
    setSessionId(sid);

    const cid = localStorage.getItem("telegram_chat_id");
    if (cid) setChatId(cid);
  }, []);

  const saveChatId = (id: string) => {
    localStorage.setItem("telegram_chat_id", id);
    setChatId(id);
  };

  const clearChatId = () => {
    localStorage.removeItem("telegram_chat_id");
    setChatId("");
  };

  return { sessionId, chatId, saveChatId, clearChatId };
}
