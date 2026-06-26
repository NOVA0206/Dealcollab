'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import DealLogCard from './DealLogCard';
import { Match } from './MatchWindow';
import { DealStatus } from './StatusBadge';
import { Search, Loader2 } from 'lucide-react';

const INTENT_PHRASE: Record<string, string> = {
  BUY_SIDE: 'Seeking Acquisition Target',
  SELL_SIDE: 'Available for Acquisition',
  FUNDRAISING: 'Raising Growth Capital',
  DEBT: 'Seeking Debt Financing',
  STRATEGIC_PARTNERSHIP: 'Seeking Strategic Partner',
};

const SECTOR_LABEL: Record<string, string> = {
  pharma: 'Pharma',
  manufacturing: 'Manufacturing',
  saas: 'SaaS',
  finserv: 'Financial Services',
  consumer: 'Consumer Goods',
  realestate: 'Real Estate',
  logistics: 'Logistics',
  education: 'Education',
  chemicals: 'Chemicals',
  hospitality: 'Hospitality',
  renewable: 'Renewable Energy',
  defence: 'Defence',
  oil_gas: 'Oil & Gas',
  ngo: 'NGO / Non-Profit',
  mixed: 'Diversified',
};

interface BulkDBMatch {
  id: string;
  score: string;
  similarity: string;
  reason?: string;
  counterparty?: {
    intent: string;
    sectors?: string[];
    geographies?: string[];
    raw_text?: string | null;
    normalised_text?: string | null;
    summary_text?: string | null;
    mandate_summary?: string | null;
  } | null;
}

export interface BulkProposal {
  id: string;
  intent?: string;
  sectors?: string[];
  geographies?: string[];
  raw_text?: string | null;
  normalised_text?: string | null;
  summary_text?: string | null;
  metadata?: { mandate_summary?: string; [key: string]: unknown };
  embedding_status?: string;
  matches: BulkDBMatch[];
}

interface BulkMandateCardProps {
  proposal: BulkProposal;
  onMatchesFound: (proposalId: string) => void;
}

function generateTitle(p: BulkProposal): string {
  const mandateSummary = p.metadata?.mandate_summary;
  if (typeof mandateSummary === 'string' && mandateSummary.length > 20) {
    return mandateSummary.slice(0, 120).trim();
  }
  if (p.summary_text && p.summary_text.length > 20) {
    return p.summary_text.slice(0, 120).trim();
  }
  const sector = p.sectors?.[0] ?? '';
  const sectorLabel = SECTOR_LABEL[sector] ?? (sector ? sector.charAt(0).toUpperCase() + sector.slice(1) : 'Business');
  const intentLabel = p.intent ? (INTENT_PHRASE[p.intent] ?? p.intent) : 'Seeking Opportunity';
  const geo = p.geographies?.[0] ? ` — ${p.geographies[0]}` : '';
  return `${sectorLabel} ${intentLabel}${geo}`;
}

export default function BulkMandateCard({ proposal, onMatchesFound }: BulkMandateCardProps) {
  const router = useRouter();
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const hasMatches = proposal.matches.length > 0;
  const embeddingDone = proposal.embedding_status === 'DONE';

  // If we have matches, render using the existing DealLogCard (identical to chat UI)
  if (hasMatches) {
    const deal = {
      id: proposal.id,
      deal: generateTitle(proposal),
      sector: proposal.sectors?.[0] || 'Unknown',
      region: proposal.geographies?.[0] || 'Global',
      summary: proposal.summary_text || proposal.raw_text || 'Deal summary unavailable',
      status: 'Matched' as DealStatus,
      matches: proposal.matches.map((m: BulkDBMatch, i: number) => ({
        id: m.id,
        rank: i + 1,
        label: `P${i + 1}`,
        proposalId: proposal.id,
        finalScore: parseFloat(m.score),
        confidenceScore: parseFloat(m.similarity) * 100,
        matchReason: m.reason || 'AI alignment detected.',
        counterparty: {
          sector: m.counterparty?.sectors?.[0] || 'Unknown',
          geography: m.counterparty?.geographies?.[0] || 'Global',
          intent: m.counterparty?.intent || 'UNKNOWN',
          summary: m.counterparty?.summary_text || m.counterparty?.raw_text || 'Deal summary unavailable',
        },
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      })) as unknown as Match[],
    };

    return (
      <DealLogCard
        deal={deal}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded((p) => !p)}
        onDelete={() => {}}
        onViewMatch={(match) => router.push(`/deal-log/${match.id}`)}
        onConnectMatch={(match) => router.push(`/deal-dashboard?match=${match.id}`)}
      />
    );
  }

  // No matches yet — show mandate summary + Search Matches button
  const title = generateTitle(proposal);
  const summary = proposal.summary_text || proposal.raw_text || 'No description available.';

  const handleSearchMatches = async () => {
    setSearching(true);
    setError('');
    try {
      const res = await fetch(`/api/bulk-mandates/${proposal.id}/search-matches`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Search failed. Please try again.');
      } else {
        onMatchesFound(proposal.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed.');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="w-full flex flex-col group">
      <div className="bg-white border border-[rgba(17,17,17,0.08)] transition-all duration-300 rounded-xl px-5 py-4 shadow-[0_2px_10px_rgb(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          {/* Mandate info */}
          <div className="flex flex-col gap-1.5 flex-1 pr-4">
            <h3
              title={title}
              className="text-lg font-bold text-foreground leading-snug group-hover:text-primary-hover transition-colors line-clamp-2"
            >
              {title.length > 120 ? `${title.slice(0, 120)}…` : title}
            </h3>
            <p className="text-xs text-[#6B7280] line-clamp-2 leading-relaxed">{summary}</p>

            {/* Sector + Geo tags */}
            <div className="flex flex-wrap gap-1.5 mt-1">
              {proposal.sectors?.slice(0, 3).map((s) => (
                <span key={s} className="text-[10px] font-bold px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                  {SECTOR_LABEL[s] ?? s}
                </span>
              ))}
              {proposal.geographies?.slice(0, 2).map((g) => (
                <span key={g} className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">
                  {g}
                </span>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {!embeddingDone ? (
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-500 font-semibold">
                <Loader2 size={14} className="animate-spin" />
                Embedding...
              </div>
            ) : (
              <button
                onClick={handleSearchMatches}
                disabled={searching}
                className="flex items-center gap-2 px-4 py-2 bg-[#F97316] text-white rounded-xl text-xs font-bold hover:bg-[#EA580C] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {searching ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search size={14} />
                    Search Matches
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {error && (
          <p className="mt-3 text-xs text-red-600 font-medium">{error}</p>
        )}
      </div>
    </div>
  );
}
