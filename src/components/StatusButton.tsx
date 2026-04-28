'use client';
import React from 'react';
import { DealStatus } from './StatusBadge';
import { ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { useUser } from './UserProvider';

export type DashboardStatus = 
  | 'Send EOI' 
  | 'EOI Sent — Awaiting Approval' 
  | 'Approved' 
  | 'Declined' 
  | 'Expired'
  | 'EOI Received';

interface StatusButtonProps {
  status: DealStatus | DashboardStatus;
  isOpen?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

export default function StatusButton({ status, isOpen, onClick }: StatusButtonProps) {
  const { canSendEOI } = useUser();

  // Deal Log Statuses (Toggles)
  if (status === 'Matched' || status === 'Searching Match') {
    const isMatched = status === 'Matched';
    return (
      <button
        onClick={onClick}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border shadow-sm transition-all duration-200 active:scale-[0.98] hover:scale-[1.02] hover:brightness-105 ${
          isMatched 
            ? 'bg-green-50 text-green-600 border-green-100 hover:bg-green-100' 
            : 'bg-primary-soft text-primary-hover border-primary/20 hover:bg-primary/20'
        }`}
      >
        <span>{status}</span>
        {isOpen !== undefined && (isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
      </button>
    );
  }

  // Dashboard Statuses (Actions)
  let label: string = status;
  let colorClass = '';
  let isClickable = true;
  let showLock = false;

  switch (status) {
    case 'Send EOI':
      if (!canSendEOI) {
        label = 'Insufficient Tokens';
        colorClass = 'bg-primary-soft text-brand-secondary/40 cursor-not-allowed border-border';
        isClickable = false;
        showLock = true;
      } else {
        colorClass = 'bg-primary text-white hover:bg-primary-hover cursor-pointer shadow-md shadow-primary/30';
      }
      break;

    case 'EOI Sent — Awaiting Approval':
      label = 'Awaiting Approval';
      colorClass = 'bg-primary-soft text-brand-secondary cursor-not-allowed border border-border opacity-70';
      isClickable = false;
      break;

    case 'Approved':
      label = 'Connect';
      colorClass = 'bg-green-500 text-white hover:bg-green-600 cursor-pointer shadow-[0_0_15px_rgba(34,197,94,0.2)]';
      isClickable = true;
      break;

    case 'Declined':
      colorClass = 'bg-red-50 text-red-500 cursor-not-allowed border border-red-100 opacity-60';
      isClickable = false;
      break;

    case 'Expired':
      colorClass = 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200 opacity-50';
      isClickable = false;
      break;

    case 'EOI Received':
      label = 'Review Proposal';
      colorClass = 'bg-primary text-white hover:bg-primary-hover cursor-pointer shadow-[0_4px_15px_rgba(255,160,0,0.3)] ring-2 ring-primary/20';
      isClickable = true;
      break;

    default:
      return null;
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        disabled={!isClickable}
        onClick={(e) => {
          if (!isClickable) return;
          if (onClick) {
            onClick(e);
          } else {
            window.location.href = status === 'Approved' ? '/connect' : '#';
          }
        }}
        className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 shadow-sm whitespace-nowrap min-w-[140px] ${colorClass}`}
      >
        {showLock && <Lock size={12} />}
        {label}
      </button>
      
      {status === 'Send EOI' && !canSendEOI && (
        <a 
          href="/profile/billing" 
          className="text-[10px] font-bold text-primary-hover hover:underline"
        >
          Buy Tokens →
        </a>
      )}
    </div>
  );
}
