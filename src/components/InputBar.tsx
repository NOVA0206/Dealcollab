'use client';
import React, { useState, useRef } from 'react';
import { Plus, Send } from 'lucide-react';

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
    <div className="w-full bg-white pb-8 pt-2 px-4 md:px-6">
      <div className="max-w-3xl mx-auto relative group">
        <input 
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept=".pdf,.doc,.docx,.txt,image/*"
        />
        
        <div className="flex items-center bg-white border border-gray-200 rounded-2xl shadow-lg shadow-gray-200/50 hover:shadow-xl hover:border-gray-300 transition-all focus-within:ring-2 focus-within:ring-orange-500/10 focus-within:border-orange-500 overflow-hidden">
          <button 
            type="button"
            onClick={handlePlusClick}
            className="flex-shrink-0 w-12 h-12 flex items-center justify-center text-gray-400 hover:text-orange-500 transition-colors"
          >
            <Plus size={22} />
          </button>

          <form onSubmit={handleSubmit} className="flex-1 flex items-center">
            <input 
              type="text" 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask DealCollab AI anything..." 
              className="flex-1 bg-transparent border-none outline-none text-foreground text-[16px] py-4 pr-4 placeholder:text-gray-400"
            />
            
            <button 
              type="submit"
              disabled={!inputValue.trim()}
              className="mr-3 w-9 h-9 rounded-xl bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center transition-all disabled:opacity-20 disabled:grayscale active:scale-95 shadow-md shadow-orange-500/20"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
        
        <p className="text-center text-[10px] text-gray-400 mt-3 font-medium uppercase tracking-[0.1em]">
          Deal Intelligence Assistant • High Precision Extraction
        </p>
      </div>
    </div>
  );
}
