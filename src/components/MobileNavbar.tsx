'use client';
import React from 'react';
import { Menu, Plus } from 'lucide-react';
import Link from 'next/link';

interface MobileNavbarProps {
  onMenuClick: () => void;
  onNewChat: () => void;
}

export default function MobileNavbar({ onMenuClick, onNewChat }: MobileNavbarProps) {
  return (
    <nav className="md:hidden sticky top-0 z-50 w-full bg-white border-b border-gray-100 h-16 flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <button 
          onClick={onMenuClick}
          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-50 active:scale-95 transition-all"
        >
          <Menu size={24} className="text-gray-700" />
        </button>
        <Link href="/home" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center shrink-0">
                <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    src="/earth.mp4"
                    className="w-full h-full object-cover scale-125"
                />
            </div>
            <span className="font-bold text-sm tracking-tight">DealCollab AI</span>
        </Link>
      </div>
      
      <button 
        onClick={onNewChat}
        className="w-10 h-10 flex items-center justify-center rounded-xl bg-orange-500 text-white shadow-md shadow-orange-500/20 active:scale-95 transition-all"
      >
        <Plus size={20} />
      </button>
    </nav>
  );
}
