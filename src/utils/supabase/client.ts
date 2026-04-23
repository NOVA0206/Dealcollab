import { createClient } from '@supabase/supabase-js';

export function createSupabaseClient() {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  console.log("SUPABASE CLIENT INITIALIZED");
  return client;
}
