'use client';
import React, { useState } from 'react';
import DealCard from './DealCard';
import MatchCard from './MatchCard';
import StatusButton, { DashboardStatus } from './StatusButton';
import ConnectionDetails from './ConnectionDetails';
import IncomingEOIDetails from './IncomingEOIDetails';

export interface DashboardDeal {
  id: number;
  deal: string;
  dealDesc: string;
  match: string;
  matchDesc: string;
  status: DashboardStatus;
  isIncoming?: boolean;
}

interface DashboardRowProps {
  item: DashboardDeal;
  onEOIClick?: () => void;
}

export default function DashboardRow({ item, onEOIClick }: DashboardRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleStatusClick = () => {
    const isIncoming = item.status === ('EOI Received' as any);
    
    if (item.status === 'Approved' || isIncoming) {
      setIsExpanded(!isExpanded);
    } else if (item.status === 'Send EOI') {
      onEOIClick?.();
    }
  };

  const isIncoming = item.isIncoming;

  return (
    <div className={`flex flex-col border transition-all duration-300 rounded-2xl shadow-sm ${
      isExpanded 
        ? 'border-[#F97316]/30 bg-white ring-1 ring-[#F97316]/5' 
        : isIncoming
          ? 'bg-white border-[#F97316]/30 ring-1 ring-[#F97316]/10 shadow-[0_4px_20px_rgba(249,115,22,0.05)]'
          : 'bg-[#F9FAFB] border-[#E5E7EB] hover:bg-white hover:border-brand-accent/20'
    }`}>
      <div className="grid grid-cols-1 sm:grid-cols-12 items-stretch gap-4 p-4">
        {/* YOUR DEAL */}
        <div className="sm:col-span-12 md:col-span-5 flex flex-col">
          <div className="text-[10px] font-bold text-brand-secondary uppercase tracking-widest mb-2 px-1">
            {isIncoming ? 'Your Offer' : 'Your Deal'}
          </div>
          <DealCard title={item.deal} description={item.dealDesc} />
        </div>

        {/* SELECTED MATCH */}
        <div className="sm:col-span-12 md:col-span-4 flex flex-col">
          <div className="text-[10px] font-bold text-brand-secondary uppercase tracking-widest mb-2 px-1">
            {isIncoming ? 'Proposed Buyer/Investor' : 'AI match'}
          </div>
          <MatchCard entity={item.match} description={item.matchDesc} />
        </div>

        {/* STATUS BUTTON */}
        <div className="sm:col-span-12 md:col-span-3 flex flex-col justify-center items-center md:items-end md:pt-6">
          <StatusButton 
            status={item.status} 
            isOpen={isExpanded}
            onClick={handleStatusClick}
          />
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        isIncoming ? (
          <IncomingEOIDetails 
            item={item} 
            onApprove={() => setIsExpanded(false)} 
            onDecline={() => setIsExpanded(false)} 
          />
        ) : (
          <ConnectionDetails item={item} />
        )
      )}
    </div>
  );
}
