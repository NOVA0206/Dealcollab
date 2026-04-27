import { createClient } from '@supabase/supabase-js';

export function createSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error("SUPABASE CONFIGURATION MISSING: Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in your .env file.");
    return null;
  }

  const client = createClient(url, key);
  console.log("SUPABASE CLIENT INITIALIZED");
  return client;
}
