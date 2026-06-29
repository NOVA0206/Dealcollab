import { auth } from '@/auth';
import { executeMatchmaking } from '@/lib/matchmakingEngine';
import { createServerSupabaseClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ proposalId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { proposalId } = await params;
    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error('Supabase init failed');

    // Verify ownership and fetch proposal
    const { data: dbUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', session.user.email)
      .single();

    if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { data: proposal } = await supabase
      .from('proposals')
      .select('*')
      .eq('id', proposalId)
      .eq('source', 'bulk_upload')
      .single();

    if (!proposal) {
      return NextResponse.json({ error: 'Bulk proposal not found' }, { status: 404 });
    }
    if (proposal.user_id !== dbUser.id) {
      return NextResponse.json({ error: 'Not your proposal' }, { status: 403 });
    }

    // Clear stale matches for a clean run
    await supabase.from('proposal_matches').delete().eq('proposal_id', proposalId);

    const result = await executeMatchmaking({
      id: proposal.id,
      mandateId: proposal.mandate_id,
      userId: proposal.user_id,
      intent: proposal.intent,
      source: 'bulk_upload',
      raw_text: proposal.raw_text || '',
      sector: proposal.sectors?.[0] ?? null,
      sub_sector: null,
      geography: proposal.geographies?.[0] ?? null,
      deal_size: null,
      revenue: null,
      structure: proposal.deal_structure ?? null,
      intent_focus: null,
      industry_data: {},
      special_conditions: proposal.special_conditions || [],
      deal_size_min: proposal.deal_size_min_cr?.toString() ?? null,
      deal_size_max: proposal.deal_size_max_cr?.toString() ?? null,
      revenue_min: proposal.revenue_min_cr?.toString() ?? null,
      revenue_max: proposal.revenue_max_cr?.toString() ?? null,
    });

    return NextResponse.json({ proposalId, result });
  } catch (err) {
    console.error('[BULK_SEARCH_MATCHES] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
