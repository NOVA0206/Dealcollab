'use client';
import React from 'react';
import { Sparkles, User, MessageCircle } from 'lucide-react';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  id: string;
  type?: 'clarification' | 'deal_ready' | 'deal_saved';
  questions?: string[];
}

interface ChatAreaProps {
  messages: Message[];
  userName?: string | null;
  onQuestionClick?: (question: string) => void;
}

export default function ChatArea({ messages, onQuestionClick }: ChatAreaProps) {
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
            
            {msg.role === 'assistant' && msg.type === 'deal_saved' && (
              <div className="mt-4 p-3 bg-white rounded-xl border border-green-100 flex items-center gap-3 text-green-700 font-medium animate-in zoom-in shadow-sm">
                <Sparkles size={16} className="text-green-500" />
                <span>Your deal has been recorded and is now live.</span>
              </div>
            )}

            {msg.role === 'assistant' && msg.type === 'clarification' && msg.questions && (
              <div className="mt-6 space-y-4 animate-in slide-in-from-top-2 duration-500 bg-white rounded-xl shadow-sm p-5 border border-gray-100">
                <div className="flex items-center gap-2 mb-1">
                  <MessageCircle size={14} className="text-orange-500" />
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">💬 Tell Us More</span>
                </div>
                <div className="space-y-2">
                  {msg.questions.map((q, idx) => (
                    <button 
                      key={idx}
                      onClick={() => onQuestionClick?.(q)}
                      className="w-full text-left px-4 h-11 rounded-lg border border-gray-200 bg-gray-50 hover:bg-white hover:border-orange-500 hover:text-orange-600 transition-all text-sm font-medium flex items-center justify-between group"
                    >
                      <span>{q}</span>
                      <Sparkles size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-orange-500" />
                    </button>
                  ))}
                </div>
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
