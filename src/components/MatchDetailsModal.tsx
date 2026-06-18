'use client';
import React from 'react';
import { X, Info, Building2, Lock, Target } from 'lucide-react';
import { useUser } from './UserProvider';
import type { Match } from './MatchWindow';

interface MatchDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: Match | null;
  // Legacy compat
  matchName?: string;
  matchDescription?: string;
  matchId?: string;
}

export default function MatchDetailsModal({ isOpen, onClose, match, matchName, matchDescription, matchId }: MatchDetailsModalProps) {
  const { isEOIApproved } = useUser();
  if (!isOpen) return null;

  // Support both new Match object and legacy props
  const finalScore = match?.finalScore ?? 0;
  const reason = match?.matchReason || matchDescription || '';
  const sector = match?.counterparty?.sector || 'Undisclosed';
  const geography = match?.counterparty?.geography || 'India';
  const intent = match?.counterparty?.intent || 'Undisclosed';
  const structure = match?.counterparty?.structure;

  const resolvedId = match?.id || matchId || '';
  const matchIdNumeric = resolvedId ? parseInt(resolvedId.replace(/[^0-9]/g, '').slice(0, 4)) || 0 : 0;
  const approved = isEOIApproved(matchIdNumeric);
  const displayName = approved ? (matchName || `${sector} Counterparty`) : 'Strategic Partner';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-[#E5E7EB] animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-[#E5E7EB] bg-[#F9FAFB]">
          <div className="flex items-center gap-2">
            <Building2 size={20} className="text-[#F97316]" />
            <h3 className="text-lg font-bold text-[#1F2937]">Match Intelligence</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#6B7280] hover:text-[#1F2937] hover:bg-gray-100 rounded-full transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Identity section */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h4 className="text-xs font-bold text-[#F97316] uppercase tracking-widest">Qualified Match</h4>
              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 border border-amber-200 rounded text-[10px] text-amber-700 font-bold">
                <span>Alignment Score: {finalScore}</span>
              </div>
              {!approved && (
                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 rounded text-[10px] text-gray-500 font-bold border border-gray-200">
                  <Lock size={10} />
                  <span>Identity Protected</span>
                </div>
              )}
            </div>
            <h2 className="text-xl font-extrabold text-[#1F2937] leading-tight">{displayName}</h2>
          </div>



          {/* Counterparty details */}
          <div className="space-y-3">
            <div className="bg-[#F9FAFB] p-4 rounded-xl border border-[#E5E7EB]">
              <div className="flex items-center gap-2 mb-2">
                <Info size={14} className="text-[#6B7280]" />
                <span className="text-sm font-bold text-[#1F2937]">Counterparty Profile</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[#6B7280]">Sector:</span>{' '}
                  <span className="font-semibold text-[#1F2937]">{sector}</span>
                </div>
                <div>
                  <span className="text-[#6B7280]">Geography:</span>{' '}
                  <span className="font-semibold text-[#1F2937]">{geography}</span>
                </div>
                <div>
                  <span className="text-[#6B7280]">Intent:</span>{' '}
                  <span className="font-semibold text-[#1F2937]">{intent.replace('_', ' ')}</span>
                </div>
                {structure && (
                  <div>
                    <span className="text-[#6B7280]">Structure:</span>{' '}
                    <span className="font-semibold text-[#1F2937]">{structure}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Strategic Rationale */}
            <div className="bg-[#F9FAFB] p-4 rounded-xl border border-[#E5E7EB]">
              <div className="flex items-center gap-2 mb-2">
                <Target size={14} className="text-[#F97316]" />
                <span className="text-sm font-bold text-[#1F2937]">Strategic Rationale</span>
              </div>
              <div className="text-xs font-bold text-[#F97316] mb-1 uppercase tracking-wide">
                {match?.matchArchetype || 'Adjacency Match'}
              </div>
              <p className="text-sm text-[#6B7280] leading-relaxed">{reason}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#F9FAFB] border-t border-[#E5E7EB] flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-[#E5E7EB] bg-white rounded-lg text-sm font-bold text-[#6B7280] hover:bg-gray-50 transition-all"
          >
            Back to List
          </button>
          <button className="flex-1 px-4 py-2.5 bg-[#F97316] text-white rounded-lg text-sm font-bold hover:bg-[#EA580C] shadow-sm transition-all">
            Send Connection Request
          </button>
        </div>
      </div>
    </div>
  );
}
