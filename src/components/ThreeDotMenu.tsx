'use client';
import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Trash2, Eye } from 'lucide-react';

interface ThreeDotMenuProps {
  onDelete: () => void;
}

export default function ThreeDotMenu({ onDelete }: ThreeDotMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-brand-secondary hover:text-foreground hover:bg-black/5 transition-all"
      >
        <MoreVertical size={18} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-40 rounded-xl bg-white border border-brand-border shadow-lg p-1.5 z-30 animate-in fade-in slide-in-from-top-2 duration-200">
          <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold text-brand-secondary hover:text-foreground hover:bg-gray-50 transition-all">
            <Eye size={14} />
            <span>View P1, P2, P3</span>
          </button>
          
          <div className="my-1 border-t border-brand-border" />
          
          <button 
            onClick={() => {
              onDelete();
              setIsOpen(false);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50 transition-all"
          >
            <Trash2 size={14} />
            <span>Delete</span>
          </button>
        </div>
      )}
    </div>
  );
}
