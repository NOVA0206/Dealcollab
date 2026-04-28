'use client';
import React from 'react';
import { Sparkles, User } from 'lucide-react';
import { useUser } from './UserProvider';
import Image from 'next/image';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  id: string;
  type?: 'intro' | 'conversation' | 'clarification' | 'complete' | 'error' | 'deal_ready' | 'deal_saved';
}

interface ChatAreaProps {
  messages: Message[];
  onQuestionClick?: (question: string) => void;
}

export default function ChatArea({ messages }: ChatAreaProps) {
  const { profile } = useUser();

  return (
    <div className="space-y-10 chat-container-max py-4">
      {messages.map((msg) => (
        <div 
          key={msg.id} 
          className={`flex items-start gap-4 w-full animate-in fade-in duration-700 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
        >
          {/* Avatar Icon */}
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm mt-1 border transition-all overflow-hidden ${
            msg.role === 'assistant' 
              ? 'bg-primary-soft border-border text-primary-hover' 
              : 'bg-primary border-border text-white'
          }`}>
            {msg.role === 'assistant' ? (
              <Sparkles size={18} />
            ) : profile?.userAvatar ? (
              <Image src={profile.userAvatar} alt="User" width={36} height={36} className="w-full h-full object-cover" />
            ) : (
              <User size={18} />
            )}
          </div>
          
          <div className={`flex flex-col gap-2 max-w-[85%] sm:max-w-[75%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div 
              className={`px-5 py-4 rounded-2xl shadow-sm transition-all ${
                msg.role === 'user' 
                  ? 'bg-primary text-white rounded-tr-sm shadow-primary/20' 
                  : 'bg-primary-soft text-foreground rounded-tl-sm border border-border'
              }`}
            >
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap font-medium">
                {msg.content}
              </p>
            </div>
            
            {msg.role === 'assistant' && msg.type === 'complete' && (
              <div className="mt-2 p-4 bg-[#F0FFF4] border border-[#C6F6D5] rounded-2xl flex items-center gap-3 text-[#2F855A] text-sm font-bold animate-in zoom-in duration-700 shadow-sm">
                <div className="w-6 h-6 rounded-lg bg-[#48BB78] flex items-center justify-center text-white shrink-0">
                  <Sparkles size={12} />
                </div>
                <span>Deal captured and intelligence extracted successfully.</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
