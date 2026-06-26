/**
 * Direct rematch script — runs matchmaking without needing HTTP auth.
 * Usage: npx tsx --env-file=.env scripts/rematch.ts <proposalId>
 */

import { createClient } from '@supabase/supabase-js';
import { executeMatchmaking } from '../src/lib/matchmakingEngine';

const PROPOSAL_ID = process.argv[2] || '4b74f9ee-5aa2-4035-8661-2b9f0659e3b3';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function main() {
    console.log(`\n[REMATCH] Fetching proposal: ${PROPOSAL_ID}`);

    const { data: p, error } = await supabase
        .from('proposals')
        .select('*')
        .eq('id', PROPOSAL_ID)
        .single();

    if (error || !p) {
        console.error('[REMATCH] ❌ Proposal not found:', error?.message);
        process.exit(1);
    }

    console.log(`[REMATCH] Found: intent=${p.intent} sector=${p.sectors?.[0]} geo=${p.geographies?.[0]}`);
    console.log(`[REMATCH] Clearing old matches...`);

    const { error: delErr } = await supabase
        .from('proposal_matches')
        .delete()
        .eq('proposal_id', PROPOSAL_ID);

    if (delErr) console.warn('[REMATCH] Delete warning:', delErr.message);
    else console.log('[REMATCH] ✅ Old matches cleared');

    console.log('[REMATCH] Running matchmaking engine...\n');

    const result = await executeMatchmaking({
        id: p.id,
        mandateId: p.mandate_id,
        userId: p.user_id,
        intent: p.intent,
        raw_text: p.raw_text || '',
        sector: p.sectors?.[0] ?? null,
        sub_sector: null,
        geography: p.geographies?.[0] ?? null,
        deal_size: null,
        revenue: null,
        structure: p.deal_structure,
        intent_focus: null,
        industry_data: {},
        special_conditions: p.special_conditions || [],
        deal_size_min: p.deal_size_min_cr?.toString() ?? null,
        deal_size_max: p.deal_size_max_cr?.toString() ?? null,
        revenue_min: p.revenue_min_cr?.toString() ?? null,
        revenue_max: p.revenue_max_cr?.toString() ?? null,
    });

    console.log('\n[REMATCH] ✅ Done:', result);
}

main().catch(err => {
    console.error('[REMATCH] Fatal error:', err);
    process.exit(1);
});
