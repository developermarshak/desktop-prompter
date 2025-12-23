import React, { useRef, useEffect, useState } from 'react';
import { Send, User, Bot, X, Loader2, Sparkles } from 'lucide-react';
import { ChatMessage } from '../types';
import ReactMarkdown from 'react-markdown';

interface ChatAssistantProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (text: string) => void;
  onClose: () => void;
}

export const ChatAssistant: React.FC<ChatAssistantProps> = ({
  messages,
  isLoading,
  onSendMessage,
  onClose,
}) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900">
      <div className="h-16 flex items-center justify-between px-4 border-b border-zinc-800 bg-zinc-900 shrink-0">
        <h3 className="font-semibold text-zinc-200 flex items-center gap-2">
          <Bot className="w-4 h-4 text-indigo-400" />
          AI Assistant
        </h3>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-zinc-800 text-zinc-400 rounded-md transition-colors"
          title="Close Panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div 
        className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-zinc-900/50"
        ref={scrollRef}
      >
        {messages.length === 0 && (
            <div className="text-center mt-10 p-4">
                <div className="bg-indigo-500/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Sparkles className="w-6 h-6 text-indigo-400" />
                </div>
                <h4 className="text-zinc-300 font-medium mb-1">How can I help?</h4>
                <p className="text-zinc-500 text-sm">Ask me to refine your prompt, suggest templates, or brainstorm ideas.</p>
            </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                msg.role === 'user' ? 'bg-zinc-700 text-zinc-300' : 'bg-indigo-600 text-white'
              }`}
            >
              {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            <div
              className={`max-w-[85%] rounded-lg px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                msg.role === 'user'
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'bg-zinc-800/50 text-zinc-300 border border-zinc-700/50'
              }`}
            >
              <div className="prose prose-invert prose-sm max-w-none break-words">
                 <ReactMarkdown>{msg.text}</ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3">
             <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
               <Bot className="w-4 h-4" />
             </div>
             <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                <span className="text-xs text-zinc-500">Thinking...</span>
             </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-zinc-800 bg-zinc-900 shrink-0">
        <form onSubmit={handleSubmit} className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Send a message..."
            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg pl-4 pr-10 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder:text-zinc-600"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-2 top-2.5 p-1 text-zinc-400 hover:text-indigo-400 disabled:opacity-50 disabled:hover:text-zinc-400 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};