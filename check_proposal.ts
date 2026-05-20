import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function main() {
    const { data: p } = await supabase
        .from('proposals')
        .select('id, user_id, intent, sectors')
        .eq('id', '4b74f9ee-5aa2-4035-8661-2b9f0659e3b3')
        .single();
    
    console.log("Proposal:", p);
}
main();
