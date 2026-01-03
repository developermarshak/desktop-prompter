import { useState, useEffect, useRef } from "react";
import { ChatMessage } from "../types";
import { createChatSession, sendMessageStream } from "../services/geminiService";
import { Chat } from "@google/genai";

export interface UseChatManagerResult {
  messages: ChatMessage[];
  chatLoading: boolean;
  chatOpen: boolean;
  setChatOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleSendMessage: (text: string) => Promise<void>;
}

export function useChatManager(): UseChatManagerResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const chatSessionRef = useRef<Chat | null>(null);

  // Initialize chat session
  useEffect(() => {
    chatSessionRef.current = createChatSession();
  }, []);

  const handleSendMessage = async (text: string) => {
    setChatLoading(true);
    const userMsgId = crypto.randomUUID();
    const botMsgId = crypto.randomUUID();

    const userMessage: ChatMessage = {
      id: userMsgId,
      role: "user",
      text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);

    try {
      if (!chatSessionRef.current) {
        chatSessionRef.current = createChatSession();
      }

      const stream = await sendMessageStream(chatSessionRef.current, text);

      setMessages((prev) => [
        ...prev,
        {
          id: botMsgId,
          role: "model",
          text: "",
          timestamp: Date.now(),
        },
      ]);

      let accumulatedText = "";
      for await (const chunk of stream) {
        const chunkText = chunk.text || "";
        accumulatedText += chunkText;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === botMsgId ? { ...m, text: accumulatedText } : m
          )
        );
      }
    } catch (error) {
      console.error("Chat Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "model",
          text: "I'm having trouble connecting right now. Please try again.",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  return {
    messages,
    chatLoading,
    chatOpen,
    setChatOpen,
    handleSendMessage,
  };
}
