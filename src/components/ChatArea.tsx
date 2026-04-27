'use client';
import React from 'react';
import { Sparkles, User } from 'lucide-react';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  id: string;
  type?: 'intro' | 'conversation' | 'clarification' | 'complete' | 'error' | 'deal_ready' | 'deal_saved';
  questions?: string[];
}

interface ChatAreaProps {
  messages: Message[];
  userName?: string | null;
  onQuestionClick?: (question: string) => void;
}

export default function ChatArea({ messages }: ChatAreaProps) {
  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {messages.map((msg) => (
        <div key={msg.id} className={`flex items-start gap-4 w-full ${msg.role === 'user' ? 'justify-end' : ''}`}>
          {msg.role === 'assistant' && (
            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0 shadow-sm mt-1">
              <Sparkles size={16} className="text-orange-500" />
            </div>
          )}
          
          <div 
            className={`max-w-[85%] px-4 py-3 rounded-2xl ${
              msg.role === 'user' 
                ? 'bg-orange-500 text-white rounded-tr-sm shadow-md' 
                : 'bg-gray-100 text-foreground rounded-tl-sm'
            }`}
          >
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
            
            {msg.role === 'assistant' && msg.type === 'complete' && (
              <div className="mt-4 p-3 bg-white rounded-xl border border-green-100 flex items-center gap-3 text-green-700 font-medium animate-in zoom-in shadow-sm">
                <Sparkles size={16} className="text-green-500" />
                <span>Deal synchronization complete.</span>
              </div>
            )}
          </div>

          {msg.role === 'user' && (
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0 mt-1 overflow-hidden">
              <User size={18} className="text-gray-500" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
