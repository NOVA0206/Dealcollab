import { createClient } from '@supabase/supabase-js';
import { executeMatchmaking } from '../src/lib/matchmakingEngine';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
    const { data: dbUser } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', 'jeevanj020604@gmail.com')
      .single();
    
    const { data: proposals } = await supabase
        .from('proposals')
        .select('*')
        .eq('user_id', dbUser?.id)
        .eq('status', 'ACTIVE');
    
    const saasProposals = proposals?.filter(p => p.sectors?.includes('saas') || p.sectors?.includes('saas ')) || [];

    console.log(`Found ${saasProposals.length} active SaaS proposals for user`);

    for (const p of saasProposals) {
        console.log(`\nRematching ${p.id}...`);
        
        await supabase
            .from('proposal_matches')
            .delete()
            .eq('proposal_id', p.id);

        try {
            await executeMatchmaking({
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
            console.log(`✅ Success for ${p.id}`);
        } catch(e) {
            const err = e instanceof Error ? e : new Error(String(e));
            console.error(`❌ Failed for ${p.id}: ${err.message}`);
        }
    }
}

main();
