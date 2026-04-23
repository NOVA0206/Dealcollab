'use client';
import React from 'react';
import { Sparkles, Search } from 'lucide-react';
import ActionButtons from './ActionButtons';
import { useUser } from './UserProvider';
import { DealStatus } from './StatusBadge';

export interface Match {
  id: string;
  name: string;
  description: string;
}

interface MatchWindowProps {
  status: DealStatus;
  matches: Match[];
  onViewMatch: (match: Match) => void;
  onConnectMatch: (match: Match) => void;
  isOpen: boolean;
}

export default function MatchWindow({ status, matches, onViewMatch, onConnectMatch, isOpen }: MatchWindowProps) {
  const { isEOIApproved } = useUser();
  const isMatched = status === 'Matched';

  return (
    <div 
      className={`grid transition-[grid-template-rows,margin,opacity] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden ${
        isOpen ? 'grid-rows-[1fr] mt-3 opacity-100' : 'grid-rows-[0fr] mt-0 opacity-0'
      }`}
    >
      <div className="min-h-0">
        <div 
          className={`bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-5 shadow-sm transition-all duration-200 ease-out transform ${
            isOpen 
              ? 'opacity-100 scale-100 translate-y-0 visible' 
              : 'opacity-0 scale-[0.985] translate-y-1.5 invisible'
          }`}
        >
        {isMatched ? (
          <>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-[#F97316]/10 rounded-lg">
                <Sparkles size={16} className="text-[#F97316]" />
              </div>
              <h4 className="text-sm font-bold text-[#1F2937]">You got an exact match</h4>
            </div>

            <div className="space-y-4">
              {matches.map((match, index) => {
                const matchIdNumeric = parseInt(match.id.replace('p', '')) * 1000; // Mock ID conversion
                const approved = isEOIApproved(matchIdNumeric);
                const displayName = approved ? match.name : `Strategic Partner P${index + 1}`;

                return (
                  <div 
                    key={match.id} 
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white border border-[#E5E7EB] rounded-xl hover:border-[#F97316]/30 transition-all group"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black text-[#F97316] uppercase tracking-widest bg-[#F97316]/10 px-1.5 py-0.5 rounded">
                          P{index + 1}
                        </span>
                        <h5 className="text-[15px] font-bold text-[#1F2937] group-hover:text-[#F97316] transition-colors">
                          {displayName}
                        </h5>
                      </div>
                      <p className="text-xs text-[#6B7280] line-clamp-1 leading-relaxed">
                        {match.description}
                      </p>
                    </div>

                    <ActionButtons 
                      onView={() => onViewMatch(match)}
                      onConnect={() => onConnectMatch(match)}
                      label={`P${index + 1}`}
                      variant="match"
                    />
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center border border-[#E5E7EB] mb-4 shadow-sm">
              <Search size={22} className="text-[#F97316] animate-pulse" />
            </div>
            <p className="max-w-md text-sm font-medium text-[#6B7280] leading-relaxed">
              Currently unable to find potential matches for your proposed deal. 
              <span className="block mt-1 font-bold text-[#1F2937]">Please wait until a match is found. You will be notified.</span>
            </p>
          </div>
        )}
      </div>
    </div>
  </div>
  );
}
