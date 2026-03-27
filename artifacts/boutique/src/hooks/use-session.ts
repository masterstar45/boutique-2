import { useState, useEffect } from 'react';

export function useSession() {
  const [sessionId, setSessionId] = useState<string>("");
  const [chatId, setChatId] = useState<string>("");
  const [username, setUsername] = useState<string>("");

  useEffect(() => {
    let sid = localStorage.getItem("cart_session_id");
    if (!sid) {
      sid = "session_" + Math.random().toString(36).substring(2, 15);
      localStorage.setItem("cart_session_id", sid);
    }
    setSessionId(sid);

    const cid = localStorage.getItem("telegram_chat_id");
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
