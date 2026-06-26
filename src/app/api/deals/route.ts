import { auth } from '@/auth';
import { createServerSupabaseClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/deals
//
// Returns the authenticated user's chat-created proposals with their matches.
//
// Single nested-SELECT query — no .in() with ID arrays, so no URL overflow.
// PostgREST resolves proposal_matches!proposal_id via FK on the server side.
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_LIMIT = 100;

export async function GET() {
  const start = Date.now();

  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error('Supabase client failed to initialize');

    const { data: dbUser, error: userErr } = await supabase
      .from('users')
      .select('id')
      .eq('email', session.user.email)
      .single();

    if (userErr || !dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Single query: proposals + their matches + counterparty data
    // Uses PostgREST relational embedding (server-side JOIN) — eliminates .in() array.
    // Disambiguation: !proposal_id selects the FK to proposals from proposal_matches.
    const { data: rawProposals, error: proposalsErr } = await supabase
      .from('proposals')
      .select(`
        id,
        intent,
        sectors,
        geographies,
        deal_size_min_cr,
        deal_size_max_cr,
        status,
        created_at,
        raw_text,
        normalised_text,
        summary_text,
        metadata,
        proposal_matches!proposal_id (
          id,
          final_score,
          similarity_score,
          match_reason,
          matched_proposal_id,
          matched_proposal:proposals!matched_proposal_id (
            id,
            intent,
            sectors,
            geographies,
            deal_size_min_cr,
            deal_size_max_cr,
            deal_structure,
            raw_text,
            normalised_text,
            summary_text,
            metadata
          )
        )
      `)
      .eq('user_id', dbUser.id)
      .eq('status', 'ACTIVE')
      .neq('source', 'bulk_upload')
      .order('created_at', { ascending: false })
      .limit(PAGE_LIMIT);

    if (proposalsErr) {
      console.error('[GET /api/deals] Query error:', proposalsErr.message);
      throw proposalsErr;
    }

    const proposals = rawProposals ?? [];
    console.log(`[GET /api/deals] userId=${dbUser.id} | proposals=${proposals.length} | ${Date.now() - start}ms`);

    // Transform: flatten proposal_matches into the shape the frontend expects
    const result = proposals.map((proposal) => {
      const rawMatches = (proposal.proposal_matches ?? []) as Array<{
        id: string;
        final_score: string;
        similarity_score: string;
        match_reason: string;
        matched_proposal_id: string;
        matched_proposal: unknown;
      }>;

      // Sort matches by score descending (PostgREST does not guarantee nested order)
      const sortedMatches = [...rawMatches].sort(
        (a, b) => parseFloat(b.final_score) - parseFloat(a.final_score),
      );

      const matches = sortedMatches.map((m) => {
        const cp = (Array.isArray(m.matched_proposal) ? m.matched_proposal[0] : m.matched_proposal) as Record<string, unknown> | null;
        return {
          id: m.id,
          score: m.final_score,
          similarity: m.similarity_score,
          reason: m.match_reason,
          matchedProposalId: m.matched_proposal_id,
          counterparty: cp
            ? {
                intent: cp.intent as string,
                sectors: cp.sectors as string[],
                geographies: cp.geographies as string[],
                size_min: cp.deal_size_min_cr,
                size_max: cp.deal_size_max_cr,
                raw_text: cp.raw_text as string | null,
                normalised_text: cp.normalised_text as string | null,
                summary_text: (cp.summary_text as string | null) ?? null,
                mandate_summary:
                  ((cp.metadata as Record<string, unknown> | null)?.mandate_summary as string | null) ?? null,
              }
            : null,
        };
      });

      // Exclude proposal_matches from the spread to avoid sending raw nested data
      const { proposal_matches: _ignored, ...proposalFields } = proposal as typeof proposal & { proposal_matches?: unknown };
      return { ...proposalFields, matches };
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[GET /api/deals] ERROR after ${Date.now() - start}ms:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
