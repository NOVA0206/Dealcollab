'use client';

import { useEffect, useState, useCallback } from 'react';
import { useChat } from '@/components/ChatProvider';
import { ConversationState } from '@/lib/types';

interface Match {
    rank: string;            // P1, P2, P3
    matchId: string;
    proposalId: string;
    finalScore: number;
    label: string;           // VERIFIED_MATCH | HIGH_CONFIDENCE
    reason: string;
    sectorFit: string | null;
    revenueFit: string | null;
    strategicFit: string | null;
    geographyFit: string | null;
    riskFlags: string[];
    summary: string;
    intent: string | null;
    sectors: string[];
    geographies: string[];
    dealStructure: string | null;
    sizeRange: string | null;
    teaser: string;
    qualityTier: string | null;
    isConnected: boolean;
    revealedContact: { phone: string | null; advisor: string | null } | null;
}

interface MatchesResponse {
    proposalId: string;
    matchCount: number;
    isSearching?: boolean;
    matches: Match[];
    tokensRequired: number;
    userTokens: number;
    canConnect: boolean;
    message: string;
}

type View = 'list' | 'detail' | 'connected';

export function MatchPanel({ proposalId, onStartOver }: { proposalId: string; onStartOver: () => void }) {
    const { setConversationState } = useChat();
    const [data, setData] = useState<MatchesResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<View>('list');
    const [selected, setSelected] = useState<Match | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [pollsCount, setPollsCount] = useState(0);

    useEffect(() => {
        if (data) {
            if (data.matches && data.matches.length > 0) {
                console.log("[MATCHMAKING] Rendering results");
                console.log("[UI] Rendering matches");
            }
            setConversationState(ConversationState.COMPLETE);
        }
    }, [data, setConversationState]);

    const fetchMatches = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/matches/${proposalId}`);
            const json = await res.json();
            if (!res.ok) {
                setError(json.error || 'Failed to load matches');
                setData(null);
                return;
            }
            setData(json);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }, [proposalId]);

    useEffect(() => {
        let isMounted = true;

        const doFetch = async () => {
            if (!isMounted) return;
            await fetchMatches();
        };

        doFetch();

        return () => {
            isMounted = false;
        };
    }, [fetchMatches]);

    // Use a separate effect to trigger the next poll based on current data
    useEffect(() => {
        let timerId: NodeJS.Timeout;
        if (data && data.matchCount === 0 && pollsCount < 20) {
             timerId = setTimeout(() => {
                 setPollsCount(p => p + 1);
                 fetchMatches();
             }, 3000);
        }
        return () => clearTimeout(timerId);
    }, [data, pollsCount, fetchMatches]);


    if (loading && !data) return <div className="p-4 text-sm text-gray-500">Loading matches…</div>;
    if (error && !data) return <div className="p-4 text-sm text-red-600">{error}</div>;
    if (!data || !data.matches) return null;

    if (data.matchCount === 0) {
        if (data.isSearching !== false && pollsCount < 20) {
            return (
                <div className="p-4 rounded-lg border border-amber-200 bg-amber-50 animate-pulse">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-amber-500 rounded-full animate-ping" />
                        <p className="text-sm font-medium text-amber-900">Scanning the network for aligned counterparties…</p>
                    </div>
                    <p className="text-xs text-amber-700 mt-1">Our intelligence engine is evaluating sector, geography, deal size, and strategic fit across the proposal universe.</p>
                </div>
            );
        } else {
            return (
                <div className="p-4 rounded-lg border border-gray-200 bg-gray-50 space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                        <p className="text-sm font-medium text-gray-900">Mandate Monitoring Active</p>
                    </div>
                    <p className="text-xs text-gray-600">No immediate matches found. Your mandate has been registered and remains live for 90 days.</p>
                    <p className="text-xs text-gray-500">New proposals, mandates, and advisor submissions are continuously evaluated. You will be notified when relevant counterparties are identified.</p>
                    <button onClick={onStartOver} className="mt-1 text-xs text-gray-500 underline w-full text-left">
                        Start over with a new mandate
                    </button>
                </div>
            );
        }
    }

    // LIST view — P1/P2/P3 cards
    if (view === 'list') {
        return (
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Aligned counterparties</h3>
                    <span className="text-xs text-gray-500">
                        {data.userTokens} tokens · {data.tokensRequired} per connect
                    </span>
                </div>
                {data.matches.map((m) => {
                    const labelText = m.finalScore >= 75 ? 'High Match' : m.finalScore >= 55 ? 'Good Match' : 'Possible Match';
                    const labelClass = m.finalScore >= 75
                        ? 'bg-green-100 text-green-800'
                        : m.finalScore >= 55
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-gray-100 text-gray-700';
                    return (
                        <div key={m.matchId} className="border rounded-lg p-3 hover:border-amber-400 transition">
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-1 flex-wrap">
                                    <span className="text-xs font-bold text-amber-600">{m.rank}</span>
                                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${labelClass}`}>{labelText}</span>
                                    <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-medium border border-gray-200">Score: {m.finalScore}</span>
                                    {m.isConnected && (
                                        <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">Connected</span>
                                    )}
                                </div>
                            </div>
                            <p className="text-sm font-medium mb-1">{m.summary}</p>
                            {(m.sectorFit || m.geographyFit) && (
                                <div className="flex gap-1 flex-wrap mb-2">
                                    {m.sectorFit && (
                                        <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-100">
                                            ⬡ {m.sectorFit.length > 45 ? `${m.sectorFit.slice(0, 45)}…` : m.sectorFit}
                                        </span>
                                    )}
                                    {m.geographyFit && (
                                        <span className="text-xs px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-100">
                                            ◎ {m.geographyFit.length > 45 ? `${m.geographyFit.slice(0, 45)}…` : m.geographyFit}
                                        </span>
                                    )}
                                </div>
                            )}
                            <p className="text-xs text-gray-600 mb-2">{m.reason}</p>
                            {m.teaser && <p className="text-xs text-gray-500 italic line-clamp-2">{m.teaser}</p>}
                            <button
                                onClick={() => { setSelected(m); setView(m.isConnected ? 'connected' : 'detail'); }}
                                className="mt-2 text-xs font-medium text-amber-700 hover:underline"
                            >
                                View details →
                            </button>
                        </div>
                    );
                })}
                <div className="rounded-lg border border-green-100 bg-green-50 p-3">
                    <p className="text-xs font-semibold text-green-800">✓ Mandate Monitoring Active</p>
                    <p className="text-xs text-green-700 mt-0.5">New counterparties are continuously evaluated against your mandate. Stronger matches surface as the network grows.</p>
                </div>
                <button onClick={onStartOver} className="text-xs text-gray-500 underline">
                    Start over with a new mandate
                </button>
            </div>
        );
    }

    // DETAIL view — selected match without Connect button
    if (view === 'detail' && selected) {
        const labelText = selected.finalScore >= 75 ? 'High Match' : selected.finalScore >= 55 ? 'Good Match' : 'Possible Match';
        const labelClass = selected.finalScore >= 75
            ? 'bg-green-100 text-green-800'
            : selected.finalScore >= 55
                ? 'bg-amber-100 text-amber-800'
                : 'bg-gray-100 text-gray-700';
        return (
            <div className="space-y-3 border rounded-lg p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold">{selected.rank}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${labelClass}`}>{labelText}</span>
                    </div>
                </div>
                <p className="text-sm font-medium">{selected.summary}</p>
                <p className="text-xs text-gray-600">{selected.reason}</p>

                {(selected.sectorFit || selected.revenueFit || selected.strategicFit || selected.geographyFit) && (
                    <div className="bg-gray-50 rounded p-3 space-y-2">
                        <p className="text-xs font-semibold text-gray-700">Why this matched:</p>
                        {selected.sectorFit && (
                            <div className="flex gap-2 text-xs">
                                <span className="text-gray-500 w-28 shrink-0">Sector alignment</span>
                                <span className="text-gray-800">{selected.sectorFit}</span>
                            </div>
                        )}
                        {selected.geographyFit && (
                            <div className="flex gap-2 text-xs">
                                <span className="text-gray-500 w-28 shrink-0">Geography alignment</span>
                                <span className="text-gray-800">{selected.geographyFit}</span>
                            </div>
                        )}
                        {selected.revenueFit && (
                            <div className="flex gap-2 text-xs">
                                <span className="text-gray-500 w-28 shrink-0">Deal size alignment</span>
                                <span className="text-gray-800">{selected.revenueFit}</span>
                            </div>
                        )}
                        {selected.strategicFit && (
                            <div className="flex gap-2 text-xs">
                                <span className="text-gray-500 w-28 shrink-0">Strategic alignment</span>
                                <span className="text-gray-800">{selected.strategicFit}</span>
                            </div>
                        )}
                    </div>
                )}
                {selected.riskFlags && selected.riskFlags.length > 0 && (
                    <div className="rounded p-3 bg-amber-50 border border-amber-200 space-y-1">
                        <p className="text-xs font-semibold text-amber-800 mb-1">Risk flags</p>
                        {selected.riskFlags.map((flag, i) => (
                            <p key={i} className="text-xs text-amber-700">⚠ {flag}</p>
                        ))}
                    </div>
                )}

                {selected.teaser && (
                    <div className="bg-gray-50 rounded p-3 text-xs italic text-gray-700">
                        &quot;{selected.teaser}&quot;
                    </div>
                )}
                <div className="border-t pt-3">
                    <p className="text-sm font-medium text-amber-700 mb-4 text-center">
                        To see the matches with detail you can go to Deal Log
                    </p>
                    <div className="flex justify-center">
                        <button
                            onClick={() => { setSelected(null); setView('list'); setError(null); }}
                            className="px-6 py-2 rounded border text-sm hover:bg-gray-50 w-full"
                        >
                            Back to list
                        </button>
                    </div>
                    <button onClick={onStartOver} className="mt-3 text-xs text-gray-500 underline w-full">
                        Start over
                    </button>
                </div>
            </div>
        );
    }

    // CONNECTED view — counterparty revealed
    if (view === 'connected' && selected?.revealedContact) {
        return (
            <div className="space-y-3 border rounded-lg p-4 bg-green-50 border-green-200">
                <div className="flex items-center gap-2">
                    <span className="text-green-700 font-semibold">✓ Connected to {selected.rank}</span>
                </div>
                <p className="text-sm font-medium">{selected.summary}</p>
                <div className="bg-white border rounded p-3 space-y-1">
                    {selected.revealedContact.advisor && (
                        <p className="text-sm"><strong>Advisor:</strong> {selected.revealedContact.advisor}</p>
                    )}
                    {selected.revealedContact.phone && (
                        <p className="text-sm"><strong>Phone:</strong> {selected.revealedContact.phone}</p>
                    )}
                </div>
                <p className="text-xs text-gray-600">
                    The counterparty has been notified of your interest. Initiate contact at your discretion.
                </p>
                <div className="flex gap-2 pt-2">
                    <button
                        onClick={() => { setSelected(null); setView('list'); }}
                        className="px-4 py-2 rounded border text-sm hover:bg-gray-50"
                    >
                        Back to list
                    </button>
                    <button
                        onClick={onStartOver}
                        className="px-4 py-2 rounded text-sm text-amber-700 hover:underline"
                    >
                        Start over
                    </button>
                </div>
            </div>
        );
    }

    return null;
}