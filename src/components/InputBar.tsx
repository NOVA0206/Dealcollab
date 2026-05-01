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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (inputValue.trim() || pendingFile) {
      onSendMessage(inputValue.trim(), pendingFile);
      setInputValue('');
      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Auto-resize height based on value
  React.useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 200)}px`;
    }
  }, [inputValue]);

  const handlePlusClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPendingFile(file);
      // DO NOT append filename to inputValue
      // The file preview badge above the input already shows the attachment
      // Appending [Attached: name] to the message breaks the intelligence engine
    }
    // Reset file input so same file can be reselected if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
        
        <form 
          onSubmit={handleSubmit}
          className="flex flex-col bg-white border border-border rounded-2xl shadow-lg shadow-primary/5 hover:shadow-xl hover:border-primary/30 transition-all focus-within:ring-4 focus-within:ring-primary/10 focus-within:border-primary overflow-hidden"
        >
          {/* File Attachment Preview Badge */}
          {pendingFile && (
            <div className="flex items-center gap-2 px-4 py-2 bg-primary-soft/50 border-b border-border animate-in slide-in-from-top-2">
              <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center">
                <Plus size={14} className="text-primary rotate-45" />
              </div>
              <span className="text-xs font-medium text-foreground/80 truncate max-w-[200px]">
                {pendingFile.name}
              </span>
              <button 
                type="button"
                onClick={() => setPendingFile(null)}
                className="ml-auto p-1 hover:bg-black/5 rounded-full transition-colors"
              >
                <Plus size={14} className="text-brand-secondary rotate-45" />
              </button>
            </div>
          )}

          <div className="flex items-center relative">
            <button 
              type="button"
              onClick={handlePlusClick}
              className="flex-shrink-0 w-12 h-12 flex items-center justify-center text-brand-secondary hover:text-primary-hover transition-colors z-10"
              title="Attach Document"
            >
              <Plus size={22} className={pendingFile ? "text-primary" : ""} />
            </button>
   
            <div className="flex-1 flex items-start pt-3 relative">
              <textarea 
                ref={textareaRef}
                value={inputValue || ""}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={pendingFile ? "Add a message about this document..." : "Ask DealCollab AI anything..."} 
                rows={1}
                autoFocus
                enterKeyHint="send"
                className="flex-1 bg-transparent border-none outline-none text-foreground text-[16px] py-1 px-0 pr-4 placeholder:text-brand-secondary/60 resize-none min-h-[24px] max-h-[200px] scrollbar-hide relative z-20"
                style={{ height: 'auto' }}
              />
              
              <button 
                type="submit"
                disabled={!inputValue.trim() && !pendingFile}
                className="mr-3 mt-[-4px] w-9 h-9 rounded-xl bg-primary hover:bg-primary-hover text-white flex items-center justify-center transition-all disabled:opacity-20 disabled:grayscale active:scale-95 shadow-md shadow-primary/30 shrink-0 z-10"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </form>
        
        <p className="text-center text-[10px] text-brand-secondary mt-3 font-medium uppercase tracking-[0.1em]">
          Deal Intelligence Assistant • High Precision Extraction
        </p>
      </div>
    </div>
  );
}
