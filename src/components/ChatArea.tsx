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
  file?: {
    name: string;
    url?: string;
  };
  questions?: string[];
}

interface ChatAreaProps {
  messages: Message[];
  onQuestionClick?: (question: string) => void;
  isTyping?: boolean;
  disableQuestions?: boolean;
}

export default function ChatArea({ messages, isTyping, onQuestionClick, disableQuestions }: ChatAreaProps) {
  const { profile } = useUser();
  console.log("[ChatArea] Rendering with messages:", messages.length);

  return (
    <div className="space-y-10 chat-container-max py-4">
      {messages.map((msg) => (
        <div 
          key={msg.id} 
          className={`flex items-start gap-4 w-full animate-in fade-in duration-700 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
        >
          {/* Avatar Icon */}
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm mt-1 transition-all overflow-hidden ${
            msg.role === 'assistant' 
              ? 'bg-[#111111] text-[#F5F5F3]' 
              : 'bg-white border border-[rgba(17,17,17,0.08)] text-[#111111]'
          }`}>
            {msg.role === 'assistant' ? (
              <Sparkles size={18} className="text-[#FF6A00]" />
            ) : profile?.userAvatar ? (
              <Image src={profile.userAvatar} alt="User" width={36} height={36} className="w-full h-full object-cover" />
            ) : (
              <User size={18} />
            )}
          </div>
          
          <div className={`flex flex-col gap-2 max-w-[85%] sm:max-w-[75%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div 
              className={`px-6 py-4 rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.02)] transition-all ${
                msg.role === 'user' 
                  ? 'bg-white text-[#111111] rounded-tr-sm border border-[rgba(17,17,17,0.08)]' 
                  : 'bg-[rgba(255,255,255,0.72)] backdrop-blur-md text-[#111111] rounded-tl-sm border border-[rgba(17,17,17,0.08)]'
              }`}
            >
              {msg.file && (
                <div className={`mb-4 p-3 rounded-xl flex items-center gap-3 border ${
                  msg.role === 'user' ? 'bg-[#F5F5F3] border-[rgba(17,17,17,0.04)]' : 'bg-transparent border-[rgba(17,17,17,0.08)]'
                }`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    msg.role === 'user' ? 'bg-white shadow-sm' : 'bg-white shadow-sm'
                  }`}>
                    <span className="text-lg">📄</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold truncate ${msg.role === 'user' ? 'text-[#0F172A]' : 'text-foreground'}`}>
                      {msg.file.name}
                    </p>
                    <p className={`text-[10px] uppercase tracking-wider font-black ${msg.role === 'user' ? 'text-[#64748B]' : 'text-brand-secondary/60'}`}>
                      Document Attachment
                    </p>
                  </div>
                </div>
              )}
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap font-medium">
                {msg.content}
              </p>
            </div>
            
            {msg.role === 'assistant' && msg.type === 'complete' && (
              <div className="mt-2 p-4 bg-brand-card border border-border rounded-2xl flex items-center gap-3 text-[#2F855A] text-sm font-bold animate-in zoom-in duration-700 shadow-sm">
                <div className="w-6 h-6 rounded-lg bg-[#48BB78] flex items-center justify-center text-white shrink-0">
                  <Sparkles size={12} />
                </div>
                <span>Deal captured and intelligence extracted successfully.</span>
              </div>
            )}
            {!disableQuestions && msg.role === 'assistant' && msg.questions && msg.questions.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {msg.questions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => onQuestionClick?.(q)}
                    className="text-xs font-bold px-4 py-2 rounded-full bg-white border border-[rgba(17,17,17,0.08)] hover:border-[#FF6A00]/50 hover:bg-[#F5F5F3] text-[#4B5563] hover:text-[#111111] transition-all active:scale-95 shadow-[0_2px_8px_rgb(0,0,0,0.02)]"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}

      {isTyping && (
        <div className="flex items-start gap-4 w-full animate-in fade-in duration-500">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm mt-1 bg-[#111111] text-[#F5F5F3]">
            <Sparkles size={18} className="animate-pulse text-[#FF6A00]" />
          </div>
          <div className="bg-[rgba(255,255,255,0.72)] backdrop-blur-md text-[#111111] px-6 py-5 rounded-2xl rounded-tl-sm border border-[rgba(17,17,17,0.08)] shadow-[0_2px_10px_rgb(0,0,0,0.02)] flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-[#4B5563] rounded-full animate-bounce [animation-delay:-0.3s]"></span>
            <span className="w-1.5 h-1.5 bg-[#4B5563] rounded-full animate-bounce [animation-delay:-0.15s]"></span>
            <span className="w-1.5 h-1.5 bg-[#4B5563] rounded-full animate-bounce"></span>
          </div>
        </div>
      )}
    </div>
  );
}
