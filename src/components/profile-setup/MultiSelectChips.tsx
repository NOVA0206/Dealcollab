'use client';
import React from 'react';
import { Check } from 'lucide-react';

interface MultiSelectChipsProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  maxSelections?: number;
  label?: string;
  grid?: boolean;
}

export default function MultiSelectChips({ options, selected, onChange, maxSelections, label, grid }: MultiSelectChipsProps) {
  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter(s => s !== option));
    } else {
      if (maxSelections && selected.length >= maxSelections) return;
      onChange([...selected, option]);
    }
  };

  return (
    <div className="space-y-4">
      {label && (
        <div className="flex justify-between items-end px-1">
          <label className="text-[11px] font-black uppercase tracking-[0.2em] text-brand-secondary">{label}</label>
          <span className={`text-[10px] font-bold uppercase tracking-widest ${maxSelections && selected.length === maxSelections ? 'text-brand-accent' : 'text-brand-secondary/40'}`}>
            {selected.length} {maxSelections ? `/ ${maxSelections}` : ''} Selected
          </span>
        </div>
      )}
      <div className={grid ? "grid grid-cols-2 gap-3" : "flex flex-wrap gap-2.5"}>
        {options.map((option) => {
          const isSelected = selected.includes(option);
          const isMaxed = maxSelections && selected.length >= maxSelections && !isSelected;
          
          return (
            <button
              key={option}
              type="button"
              onClick={() => toggleOption(option)}
              disabled={!!isMaxed}
              className={`px-5 py-3.5 rounded-2xl text-[13px] font-bold transition-all flex items-center gap-2 border-2 ${
                isSelected 
                  ? 'bg-brand-accent/5 border-brand-accent text-brand-accent shadow-sm transform scale-[1.02]' 
                  : isMaxed
                    ? 'bg-gray-50 border-transparent text-gray-300 cursor-not-allowed opacity-50'
                    : 'bg-gray-50 border-transparent text-brand-secondary hover:bg-gray-100 hover:text-foreground'
              }`}
            >
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                isSelected ? 'bg-brand-accent border-brand-accent shadow-[0_0_8px_rgba(255,126,0,0.3)]' : 'border-gray-200'
              }`}>
                {isSelected && <Check size={10} className="text-white" strokeWidth={4} />}
              </div>
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
