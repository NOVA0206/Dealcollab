'use client';
import React from 'react';
import StatusButton from './StatusButton';
import { DealStatus } from './StatusBadge';
import MatchWindow, { Match } from './MatchWindow';
import ActionButtons from './ActionButtons';

interface DealLogCardProps {
  deal: {
    id: string | number;
    deal: string;
    status: DealStatus;
    matches: Match[];
    isNew?: boolean;
    isConnectionActive?: boolean;
  };
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onViewMatch: (match: Match) => void;
  onConnectMatch: (match: Match) => void;
}

export default function DealLogCard({ 
  deal, 
  isExpanded, 
  onToggle, 
  onDelete, 
  onViewMatch, 
  onConnectMatch 
}: DealLogCardProps) {
  return (
    <div className="w-full flex flex-col group">
      <div className={`bg-white border transition-all duration-300 rounded-xl px-5 py-4 shadow-[0_2px_10px_rgb(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] ${
        isExpanded ? 'border-[rgba(17,17,17,0.12)] bg-[#F5F5F3] ring-1 ring-[rgba(17,17,17,0.04)]' : 'border-[rgba(17,17,17,0.08)]'
      }`}>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-foreground leading-none group-hover:text-primary-hover transition-colors">
              {deal.deal}
            </h3>
            {deal.isNew && (
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-primary text-foreground animate-pulse">
                New
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <ActionButtons 
              onDelete={onDelete}
              variant="deal"
              isDeleteDisabled={deal.isConnectionActive}
            />
            
            <StatusButton 
              status={deal.status} 
              isOpen={isExpanded} 
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
            />
          </div>
        </div>
      </div>

      <MatchWindow 
        status={deal.status}
        matches={deal.matches}
        isOpen={isExpanded}
        onViewMatch={onViewMatch}
        onConnectMatch={onConnectMatch}
      />
    </div>
  );
}
