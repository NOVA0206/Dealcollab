'use client';
import React from 'react';
import { Sparkles, User } from 'lucide-react';

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
  return (
    <div className="space-y-10 chat-container-max py-4">
      {messages.map((msg) => (
        <div 
          key={msg.id} 
          className={`flex items-start gap-4 w-full animate-in fade-in duration-700 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
        >
          {/* Avatar Icon */}
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm mt-1 border transition-all ${
            msg.role === 'assistant' 
              ? 'bg-white border-gray-100 text-orange-500' 
              : 'bg-orange-500 border-orange-400 text-white'
          }`}>
            {msg.role === 'assistant' ? <Sparkles size={18} /> : <User size={18} />}
          </div>
          
          <div className={`flex flex-col gap-2 max-w-[85%] sm:max-w-[75%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div 
              className={`px-5 py-4 rounded-2xl shadow-sm transition-all ${
                msg.role === 'user' 
                  ? 'bg-orange-500 text-white rounded-tr-sm shadow-orange-500/10' 
                  : 'bg-gray-50 text-foreground rounded-tl-sm border border-gray-100'
              }`}
            >
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap font-medium">
                {msg.content}
              </p>
            </div>
            
            {msg.role === 'assistant' && msg.type === 'complete' && (
              <div className="mt-2 p-4 bg-green-50 border border-green-100 rounded-2xl flex items-center gap-3 text-green-700 text-sm font-bold animate-in zoom-in duration-700 shadow-sm shadow-green-500/5">
                <div className="w-6 h-6 rounded-lg bg-green-500 flex items-center justify-center text-white shrink-0">
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
