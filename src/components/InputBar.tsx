'use client';
import React, { useState, useRef } from 'react';
import { Plus, Send } from 'lucide-react';

interface InputBarProps {
  onSendMessage: (text: string, file?: File | null) => void;
}

export default function InputBar({ onSendMessage }: InputBarProps) {
  const [inputValue, setInputValue] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (inputValue.trim()) {
      // Pass both text and file if available
      onSendMessage(inputValue, pendingFile);
      setInputValue('');
      setPendingFile(null);
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
      setPendingFile(file);
      // Visually indicate attachment in the input field without changing UI structure
      setInputValue(prev => prev.includes(`[Attached:`) ? prev : prev + (prev ? ' ' : '') + `[Attached: ${file.name}]`);
    }
  };

  return (
    <div className="w-full bg-background pb-8 pt-2 px-4 md:px-6">
      <div className="max-w-3xl mx-auto relative group">
        <input 
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept=".pdf,.doc,.docx,.txt,image/*"
        />
        
        <div className="flex items-center bg-white border border-border rounded-2xl shadow-lg shadow-primary/5 hover:shadow-xl hover:border-primary/30 transition-all focus-within:ring-4 focus-within:ring-primary/10 focus-within:border-primary overflow-hidden">
          <button 
            type="button"
            onClick={handlePlusClick}
            className="flex-shrink-0 w-12 h-12 flex items-center justify-center text-brand-secondary hover:text-primary-hover transition-colors"
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
              className="flex-1 bg-transparent border-none outline-none text-foreground text-[16px] py-4 pr-4 placeholder:text-brand-secondary/60"
            />
            
            <button 
              type="submit"
              disabled={!inputValue.trim()}
              className="mr-3 w-9 h-9 rounded-xl bg-primary hover:bg-primary-hover text-white flex items-center justify-center transition-all disabled:opacity-20 disabled:grayscale active:scale-95 shadow-md shadow-primary/30"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
        
        <p className="text-center text-[10px] text-brand-secondary mt-3 font-medium uppercase tracking-[0.1em]">
          Deal Intelligence Assistant • High Precision Extraction
        </p>
      </div>
    </div>
  );
}
