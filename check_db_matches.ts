import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function main() {
    const { data, error } = await supabase
        .from('proposal_matches')
        .select('id, match_reason, proposals!matched_proposal_id(id, raw_text, normalised_text)')
        .eq('proposal_id', '4b74f9ee-5aa2-4035-8661-2b9f0659e3b3');
    
    if (error) {
        console.error(error);
        return;
    }
    
    console.log(JSON.stringify(data, null, 2));
}
main();
