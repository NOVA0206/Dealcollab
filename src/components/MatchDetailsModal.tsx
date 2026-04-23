'use client';
import React from 'react';
import { X, CheckCircle2, User, Info, Building2, Lock } from 'lucide-react';
import { useUser } from './UserProvider';

interface MatchDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchName: string;
  matchDescription: string;
  matchId?: string; // Add matchId to check approval
}

export default function MatchDetailsModal({ isOpen, onClose, matchName, matchDescription, matchId }: MatchDetailsModalProps) {
  const { isEOIApproved } = useUser();
  if (!isOpen) return null;

  const matchIdNumeric = matchId ? parseInt(matchId.replace('p', '')) * 1000 : 0;
  const approved = isEOIApproved(matchIdNumeric);
  const displayName = approved ? matchName : 'Strategic Partner';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-[#E5E7EB] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-[#E5E7EB] bg-[#F9FAFB]">
          <div className="flex items-center gap-2">
            <Building2 size={20} className="text-[#F97316]" />
            <h3 className="text-lg font-bold text-[#1F2937]">Match Details</h3>
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
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-xs font-bold text-[#F97316] uppercase tracking-widest">Qualified Match</h4>
              {!approved && (
                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 rounded text-[10px] text-gray-500 font-bold">
                   <Lock size={10} />
                   <span>Identity Locked</span>
                </div>
              )}
            </div>
            <h2 className="text-2xl font-extrabold text-[#1F2937] leading-tight">{displayName}</h2>
          </div>

          <div className="space-y-4">
            <div className="bg-[#F9FAFB] p-4 rounded-xl border border-[#E5E7EB]">
              <div className="flex items-center gap-2 mb-2">
                <Info size={16} className="text-[#6B7280]" />
                <span className="text-sm font-bold text-[#1F2937]">About this Partner</span>
              </div>
              <p className="text-sm text-[#6B7280] leading-relaxed">
                {matchDescription}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                <div className="flex items-center gap-2 text-green-700 font-bold text-xs uppercase mb-1">
                  <CheckCircle2 size={12} />
                  <span>Match Rate</span>
                </div>
                <div className="text-xl font-black text-green-700">98%</div>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                <div className="flex items-center gap-2 text-blue-700 font-bold text-xs uppercase mb-1">
                  <User size={12} />
                  <span>Verified</span>
                </div>
                <div className="text-xl font-black text-blue-700">Yes</div>
              </div>
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
          <button 
             className="flex-1 px-4 py-2.5 bg-[#F97316] text-white rounded-lg text-sm font-bold hover:bg-[#EA580C] shadow-sm transition-all"
          >
            Confirm Connection
          </button>
        </div>
      </div>
    </div>
  );
}
