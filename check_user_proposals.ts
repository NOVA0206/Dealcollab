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
    
    console.log("User:", dbUser);

    const { data: proposals, error } = await supabase
        .from('proposals')
        .select('id, intent, sectors, status')
        .eq('user_id', dbUser?.id);
    
    console.log("Proposals:", proposals);
}
main();
