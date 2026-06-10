import { createClient } from '@supabase/supabase-js';

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
        .select('id, intent, sectors, status')
        .eq('user_id', dbUser?.id)
        .eq('status', 'ACTIVE');
    
    const pharmaProposals = proposals?.filter(p => p.sectors?.includes('pharma') || p.sectors?.includes('pharma ')) || [];
    
    console.log(`Found ${pharmaProposals.length} active Pharma proposals`);

    for (const p of pharmaProposals) {
        const { data: matches } = await supabase
            .from('proposal_matches')
            .select('id, matched_proposal_id, proposals!matched_proposal_id(sectors)')
            .eq('proposal_id', p.id);
            
        console.log(`\nProposal ${p.id} (Sectors: ${p.sectors}):`);
        console.log(`Has ${matches?.length || 0} matches`);
        if (matches && matches.length > 0) {
             (matches as unknown as Array<{ matched_proposal_id: string; proposals: { sectors: string | string[] | null } | null }>).forEach((m) => {
                  console.log(`  -> Matched with ${m.matched_proposal_id} (Sectors: ${m.proposals?.sectors})`);
             });
        }
    }
}
main();
