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
    // Add user message to local state immediately
    const userMsg = {
      role: 'user' as const,
      content: text,
      id: Date.now().toString(),
    };
    
    setMessages(prev => [...prev, userMsg]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, chatId: activeChatId }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Failed to process deal');

      const aiMsg = {
        role: 'assistant' as const,
        content: data.content || data.message,
        id: (Date.now() + 1).toString(),
        type: data.type,
        questions: data.questions,
      };

      setMessages(prev => [...prev, aiMsg]);
      
      // If it was a new chat, sync the ID and refresh the sidebar sessions
      if (!activeChatId && data.chatId) {
        setActiveChatId(data.chatId);
        fetchSessions();
      }
    } catch (error) {
      console.error('Deal processing error:', error);
      const aiMsg = {
        role: 'assistant' as const,
        content: "I'm sorry, I encountered an error while processing your deal. Please try again.",
        id: (Date.now() + 2).toString(),
      };
      setMessages(prev => [...prev, aiMsg]);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full relative bg-white overflow-hidden">
      {/* Scrollable Message Area */}
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="max-w-4xl mx-auto w-full px-6 sm:px-10 py-10 pb-40">
          {loading ? (
            <div className="max-w-3xl mx-auto">
                <ChatSkeleton />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center opacity-60">
              <div className="w-16 h-16 rounded-2xl bg-orange-100 flex items-center justify-center mb-6 border border-orange-200">
                <Plus size={32} className="text-orange-500" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2 tracking-tight">Start a new conversation</h2>
              <p className="text-gray-500 text-sm max-w-xs">Describe your deal, mandate, or project to begin extraction.</p>
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
