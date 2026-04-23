'use client';
import React, { useState } from 'react';
import { Plus, ArrowUp, Lock, Sparkles } from 'lucide-react';
import { useUser } from './UserProvider';

interface InputBarProps {
  onSendMessage: (text: string) => void;
}

export default function InputBar({ onSendMessage }: InputBarProps) {
  const { setOnboarding, totalScore } = useUser();
  const [isFocused, setIsFocused] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const isDisabled = false; // Profile completion requirement removed as per user request

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (inputValue.trim() && !isDisabled) {
      onSendMessage(inputValue);
      setInputValue('');
      setOnboarding('dealSubmitted', true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      handleSubmit();
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto pb-8 pt-4">
      <form 
        id="chat-input-area"
        onSubmit={handleSubmit}
        className={`relative flex items-center bg-white border rounded-2xl p-2 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
          isDisabled
            ? 'bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed'
            : isFocused 
              ? 'border-[#F97316] shadow-[0_4px_20px_rgba(249,115,22,0.1)] ring-1 ring-[#F97316]/20' 
              : 'border-brand-border shadow-sm'
        }`}
      >
        <button 
          type="button"
          disabled={isDisabled}
          className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-brand-secondary hover:text-foreground hover:bg-gray-50 transition-all duration-200 disabled:cursor-not-allowed active:scale-90"
        >
          <Plus size={20} />
        </button>

        <input 
          type="text" 
          value={inputValue}
          disabled={isDisabled}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Submit / Describe your Proposal" 
          className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-brand-secondary px-4 text-[15px] disabled:cursor-not-allowed transition-all duration-300"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />

        <button 
          type="submit"
          disabled={isDisabled || !inputValue.trim()}
          className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white transition-all duration-300 active:scale-90 shadow-sm disabled:bg-gray-200 disabled:cursor-not-allowed ${
            isDisabled ? 'bg-gray-200' : 'bg-[#F97316] hover:bg-[#EA580C] hover:shadow-lg hover:shadow-[#F97316]/20'
          }`}
        >
          <div className="transition-transform duration-300">
            {isDisabled ? <Lock size={16} /> : <ArrowUp size={18} className="animate-in fade-in zoom-in duration-300" />}
          </div>
        </button>
      </form>

      <div className="text-center mt-3">
          <span className="flex items-center gap-1"><Sparkles size={12} className="text-[#F97316]" /> AI ready to analyze your proposals</span>
      </div>
    </div>
  );
}

