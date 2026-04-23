'use client';
import React, { useEffect, useRef } from 'react';
import { Sparkles, FileText, User } from 'lucide-react';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  id: string;
}

interface ChatAreaProps {
  messages: Message[];
  userName?: string | null;
}

export default function ChatArea({ messages, userName }: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  return (
    <div className="flex-1 flex flex-col h-full w-full max-w-4xl mx-auto">
      <div className="w-full flex-1 overflow-y-auto scrollbar-hide space-y-8 pb-8">
        {messages.length === 0 ? (
          /* Welcome Section */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-brand-accent/10 flex items-center justify-center mb-6 border border-brand-accent/20">
              <Sparkles size={32} className="text-brand-accent" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Welcome{userName ? `, ${userName}` : ''} to DealCollab AI
            </h2>
            <p className="text-brand-secondary text-[16px] max-w-md font-medium leading-relaxed">
              I'm your intelligent assistant for analyzing deals, reviewing proposals, and gathering insights. 
              How can I help you today?
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex items-start gap-4 w-full ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-lg bg-brand-accent flex items-center justify-center shrink-0 shadow-sm mt-1">
                  <Sparkles size={14} className="text-white" />
                </div>
              )}
              
              <div 
                className={`max-w-[85%] p-5 rounded-2xl shadow-sm border border-brand-border ${
                  msg.role === 'user' 
                    ? 'bg-brand-sidebar rounded-tr-sm text-foreground' 
                    : 'bg-brand-card rounded-tl-sm text-foreground'
                }`}
              >
                {msg.role === 'assistant' && (
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-brand-accent uppercase tracking-wider">AI Insight</span>
                    </div>
                )}
                <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                
                {msg.role === 'assistant' && msg.content.includes('Acme') && (
                  <div className="bg-white border border-brand-border rounded-lg p-4 mt-4 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                      <FileText size={16} className="text-brand-accent" />
                      <span className="text-foreground text-sm font-bold">Acme_Proposal_Analysis.pdf</span>
                    </div>
                    <ul className="list-disc list-inside text-brand-secondary text-sm space-y-1 font-medium">
                      <li>Pricing discrepancy found in Section 4.</li>
                      <li>SLA requirements not fully met.</li>
                    </ul>
                  </div>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center border border-brand-border shrink-0 mt-1">
                  <User size={16} className="text-brand-secondary" />
                </div>
              )}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

