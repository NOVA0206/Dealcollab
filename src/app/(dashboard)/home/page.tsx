'use client';
import React, { useEffect, useRef } from 'react';
import ChatArea from "@/components/ChatArea";
import InputBar from "@/components/InputBar";
import { ChatSkeleton } from '@/components/Skeleton';
import { Plus } from 'lucide-react';
import { useChat } from '@/components/ChatProvider';

export default function Home() {
  const { 
    messages, 
    loading, 
    activeChatId, 
    setActiveChatId, 
    setMessages, 
    fetchSessions 
  } = useChat();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    // 1. Add user message instantly
    const userMsg = {
      role: 'user' as const,
      content: text,
      id: Date.now().toString(),
    };
    
    setMessages(prev => [...prev, userMsg]);

    try {
      // 2. We can't use the context loading here easily as it's for 'loadChat'
      // but let's just proceed with the fetch. 
      // If we wanted a "bot is typing" we'd add a dummy message or use a local loading state.
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, chatId: activeChatId }),
      });

      const data = await response.json();

      if (!response.ok || data.success === false) {
        throw new Error(data.error || 'Failed to process deal');
      }

      // 3. Add AI message instantly using functional update
      const aiMsg = {
        role: 'assistant' as const,
        content: data.message || data.content || "No response",
        id: (Date.now() + 1).toString(),
        type: data.type,
        questions: data.questions,
      };

      setMessages(prev => [...prev, aiMsg]);
      console.log("Chat updated with bot response:", aiMsg);
      
      // Sync ID and sessions if needed
      if (!activeChatId && data.chatId) {
        setActiveChatId(data.chatId);
        fetchSessions();
      }
    } catch (error: unknown) {
      console.error("FULL ERROR:", error);
      console.error("STRINGIFIED:", JSON.stringify(error, null, 2));
      
      const errorMessage = error instanceof Error ? error.message : (typeof error === "string" ? error : JSON.stringify(error));
      
      setMessages(prev => [...prev, {
        role: 'assistant' as const,
        content: `❌ ERROR: ${errorMessage}`,
        id: (Date.now() + 2).toString(),
        type: 'error' as const
      }]);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full relative bg-background overflow-hidden">
      {/* Scrollable Message Area */}
      <div className="flex-1 overflow-y-auto bg-background">
        <div className="chat-container-max px-6 py-10 pb-40">
          {loading ? (
            <div className="max-w-3xl mx-auto">
                <ChatSkeleton />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary-soft flex items-center justify-center mb-6 border border-border">
                <Plus size={32} className="text-primary-hover" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2 tracking-tight">Start a new conversation</h2>
              <p className="text-brand-secondary text-sm max-w-xs">Describe your deal, mandate, or project to begin extraction.</p>
            </div>
          ) : (
            <div className="space-y-6">
                <ChatArea 
                    messages={messages} 
                    onQuestionClick={(q) => handleSendMessage(q)}
                />
            </div>
          )}
          {/* Invisible element for auto-scrolling */}
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      {/* Fixed Sticky Input Bar */}
      <div className="sticky bottom-0 left-0 w-full z-40">
        <InputBar onSendMessage={handleSendMessage} />
      </div>
    </div>
  );
}
