import { auth } from '@/auth';
import { createServerSupabaseClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { matchId } = await params;
    if (!matchId) {
      return NextResponse.json({ error: 'matchId required' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error('Supabase client failed to initialize');

    // Get current user id
    const { data: dbUser } = await supabase
      .from('users')
      .select('id, tokens')
      .eq('email', session.user.email)
      .single();

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Fetch the match from proposal_matches
    const { data: match, error: matchErr } = await supabase
      .from('proposal_matches')
      .select(`
        id,
        proposal_id,
        matched_proposal_id,
        final_score,
        match_reason,
        match_archetype,
        status
      `)
      .eq('id', matchId)
      .single();

    if (matchErr || !match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    // Verify user owns the source proposal
    const { data: userProposal } = await supabase
      .from('proposals')
      .select('id, user_id, intent, sectors, geographies')
      .eq('id', match.proposal_id)
      .single();

    if (!userProposal || userProposal.user_id !== dbUser.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: counterpartyProposal } = await supabase
      .from('proposals')
      .select(`
        id, user_id, intent, sectors, geographies,
        deal_size_min_cr, deal_size_max_cr, revenue_min_cr, revenue_max_cr,
        deal_structure, special_conditions, quality_tier, raw_text,
        contact_phone, advisor_name
      `)
      .eq('id', match.matched_proposal_id)
      .single();

    if (!counterpartyProposal) {
      return NextResponse.json({ error: 'Counterparty proposal not found' }, { status: 404 });
    }

    // Check if an EOI already exists for this match
    const { data: existingEoi } = await supabase
      .from('eois')
      .select('id, status, sender_id, receiver_id')
      .eq('match_id', matchId)
      .maybeSingle();

    const isConnected = existingEoi?.status === 'approved';

    // Helper to redact phone and email from text
    const redactText = (text: string | null) => {
      if (!text) return '';
      return text
        .replace(/\b[6-9]\d{9}\b/g, '[redacted]')
        .replace(/\S+@\S+\.\S+/g, '[redacted]');
    };

    return NextResponse.json({
      success: true,
      match: {
        id: match.id,
        proposalId: match.proposal_id,
        matchedProposalId: match.matched_proposal_id,
        finalScore: Number(match.final_score),
        matchReason: match.match_reason,
        matchArchetype: match.match_archetype,
        status: match.status,
      },
      counterparty: {
        id: counterpartyProposal.id,
        userId: counterpartyProposal.user_id,
        intent: counterpartyProposal.intent,
        sectors: counterpartyProposal.sectors || [],
        geographies: counterpartyProposal.geographies || [],
        dealSizeMinCr: counterpartyProposal.deal_size_min_cr,
        dealSizeMaxCr: counterpartyProposal.deal_size_max_cr,
        revenueMinCr: counterpartyProposal.revenue_min_cr,
        revenueMaxCr: counterpartyProposal.revenue_max_cr,
        dealStructure: counterpartyProposal.deal_structure,
        specialConditions: counterpartyProposal.special_conditions || [],
        qualityTier: counterpartyProposal.quality_tier,
        teaser: redactText(counterpartyProposal.raw_text),
        revealedContact: isConnected ? {
          phone: counterpartyProposal.contact_phone,
          advisor: counterpartyProposal.advisor_name,
        } : null,
      },
      eoi: existingEoi ? {
        id: existingEoi.id,
        status: existingEoi.status,
        isSender: existingEoi.sender_id === dbUser.id,
      } : null,
      userTokens: dbUser.tokens ?? 0,
    });
  } catch (error: any) {
    console.error('🔥 GET /api/matches/detail/[matchId] ERROR:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
