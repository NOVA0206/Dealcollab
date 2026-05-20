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
    
    // Find proposals created in the last hour with raw_text like "Find me the matches%"
    const { data: proposals } = await supabase
        .from('proposals')
        .select('id, raw_text')
        .eq('user_id', dbUser?.id)
        .like('raw_text', 'Find %')
        .order('created_at', { ascending: false });

    if (!proposals || proposals.length === 0) {
        console.log("No bogus proposals found.");
        return;
    }

    console.log(`Found ${proposals.length} bogus proposals. Deleting...`);

    for (const p of proposals) {
        console.log(`Deleting matches for proposal ${p.id}...`);
        await supabase.from('proposal_matches').delete().eq('proposal_id', p.id);
        
        console.log(`Deleting proposal ${p.id}...`);
        await supabase.from('proposals').delete().eq('id', p.id);
    }
    console.log("Cleanup complete!");
}
main();
