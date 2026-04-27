'use client';
import React, { useState, useRef, useCallback } from 'react';
import { X, Plus } from 'lucide-react';

interface TagInputProps {
  label: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  maxTags?: number;
  placeholder?: string;
  helperText?: string;
}

export default function TagInput({ label, tags, onChange, maxTags = 5, placeholder, helperText }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed || tags.length >= maxTags) return;
    if (tags.some(t => t.toLowerCase() === trimmed.toLowerCase())) return;
    onChange([...tags, trimmed]);
    setInputValue('');
    inputRef.current?.focus();
  }, [inputValue, tags, maxTags, onChange]);

  const removeTag = useCallback((index: number) => {
    onChange(tags.filter((_, i) => i !== index));
  }, [tags, onChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); }
    if (e.key === 'Backspace' && !inputValue && tags.length > 0) removeTag(tags.length - 1);
  };

  const isMaxed = tags.length >= maxTags;

  return (
    <div className="space-y-3 w-full">
      <div className="flex justify-between items-end px-1">
        <label className="text-[11px] font-black uppercase tracking-[0.2em] text-brand-secondary opacity-70">{label}</label>
        <span className={`text-[10px] font-bold uppercase tracking-widest ${isMaxed ? 'text-brand-accent' : 'text-brand-secondary/40'}`}>{tags.length} / {maxTags}</span>
      </div>
      <div className="flex flex-wrap gap-2.5 min-h-[48px]">
        {tags.map((tag, index) => (
          <div key={`${tag}-${index}`} className="group flex items-center gap-2 px-4 py-2.5 bg-brand-accent/5 border-2 border-brand-accent/20 rounded-2xl text-[13px] font-bold text-brand-accent transition-all hover:border-brand-accent">
            <span>{tag}</span>
            <button type="button" onClick={() => removeTag(index)} className="w-4 h-4 rounded-full flex items-center justify-center text-brand-accent/50 hover:text-white hover:bg-brand-accent transition-all">
              <X size={10} strokeWidth={3} />
            </button>
          </div>
        ))}
      </div>
      {!isMaxed && (
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <input 
              ref={inputRef} 
              type="text" 
              value={inputValue} 
              onChange={e => setInputValue(e.target.value)} 
              onKeyDown={handleKeyDown} 
              placeholder={placeholder || 'Type and press Enter'} 
              className="input-underline pr-12" 
            />
            <button 
              type="button" 
              onClick={addTag} 
              disabled={!inputValue.trim()} 
              className="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl flex items-center justify-center bg-brand-accent/10 text-brand-accent hover:bg-brand-accent hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Plus size={16} strokeWidth={3} />
            </button>
          </div>
        </div>
      )}
      {helperText && <p className="text-[11px] text-brand-secondary/60 font-medium px-1">{helperText}</p>}
    </div>
  );
}
