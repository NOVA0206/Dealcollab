'use client';
import React, { useState, useRef } from 'react';
import { ArrowUp, Sparkles, Plus } from 'lucide-react';

interface InputBarProps {
  onSendMessage: (text: string) => void;
}

export default function InputBar({ onSendMessage }: InputBarProps) {
  const [inputValue, setInputValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (inputValue.trim()) {
      onSendMessage(inputValue);
      setInputValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      handleSubmit();
    }
  };

  const handlePlusClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setInputValue(prev => prev + (prev ? ' ' : '') + `[Attached: ${file.name}]`);
    }
  };

  return (
    <div className="w-full bg-white border-t border-gray-100 px-4 py-3 pb-8 md:pb-6">
      <div className="max-w-3xl mx-auto flex items-center gap-3">
        <input 
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept=".pdf,.doc,.docx,.txt,image/*"
        />
        
        <button 
          type="button"
          onClick={handlePlusClick}
          className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-orange-500 hover:bg-orange-50 transition-all active:scale-90"
        >
          <Plus size={20} />
        </button>

        <form 
          onSubmit={handleSubmit}
          className="flex-1 flex items-center bg-gray-50 border border-gray-200 rounded-xl px-4 py-1.5 focus-within:border-orange-500 focus-within:bg-white transition-all shadow-sm"
        >
          <input 
            type="text" 
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your answer or describe your deal..." 
            className="flex-1 bg-transparent border-none outline-none text-foreground text-[15px] py-1.5"
          />
          
          <button 
            type="submit"
            disabled={!inputValue.trim()}
            className="w-8 h-8 rounded-lg bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center transition-all disabled:opacity-30 disabled:grayscale active:scale-90"
          >
            <ArrowUp size={18} />
          </button>
        </form>
      </div>
      <div className="text-center mt-2 flex items-center justify-center gap-1.5 text-[10px] text-gray-400 font-medium uppercase tracking-wider">
        <Sparkles size={10} className="text-orange-400" />
        AI extraction active
      </div>
    </div>
  );
}
