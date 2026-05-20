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
    
    // Get the most recent proposals for this user
    const { data: proposals } = await supabase
        .from('proposals')
        .select('id, intent, sectors, status, raw_text, created_at')
        .eq('user_id', dbUser?.id)
        .order('created_at', { ascending: false })
        .limit(5);
    
    console.log("Recent proposals:", JSON.stringify(proposals, null, 2));
}
main();
