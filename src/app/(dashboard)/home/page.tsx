'use client';
import React, { useState, useEffect } from 'react';
import ChatArea, { Message } from "@/components/ChatArea";
import InputBar from "@/components/InputBar";
import { useSession } from 'next-auth/react';
import { ChatSkeleton } from '@/components/Skeleton';

export default function Home() {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleSendMessage = (text: string) => {
    const userMsg: Message = {
      role: 'user',
      content: text,
      id: Date.now().toString(),
    };
    
    setMessages(prev => [...prev, userMsg]);

    setTimeout(() => {
      const aiMsg: Message = {
        role: 'assistant',
        content: text.toLowerCase().includes('acme') 
          ? "I've analyzed the Acme Corp proposal. I found some issues with the pricing terms and SLAs. Check the attached summary for details."
          : "I've received your query. How else can I assist you with your deal intelligence today?",
        id: (Date.now() + 1).toString(),
      };
      setMessages(prev => [...prev, aiMsg]);
    }, 1000);
  };

  return (
    <div className="flex-1 flex flex-col w-full relative bg-white min-h-0">
      {/* Scrollable Container */}
      <div className="flex-1 overflow-y-auto px-6 sm:px-10 pb-[140px] pt-10 min-h-0">
        <div className="max-w-4xl mx-auto w-full space-y-12">

          {loading ? (
            <ChatSkeleton />
          ) : (
            <ChatArea 
              messages={messages} 
              userName={session?.user?.name}
            />
          )}
        </div>
      </div>
      
      {/* Input Bar Container - Sticky Bottom */}
      {!loading && (
        <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-white via-white/90 to-transparent pt-20 px-6 sm:px-10 z-40 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
          <InputBar onSendMessage={handleSendMessage} />
        </div>
      )}
    </div>
  );
}
