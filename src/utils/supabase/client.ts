import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabaseInstance: SupabaseClient | null = null;

export function createSupabaseClient(): SupabaseClient | null {
  if (typeof window === 'undefined') return null; // Browser only
  if (_supabaseInstance) return _supabaseInstance;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error("[SUPABASE] Configuration missing in browser environment");
    return null;
  }

  _supabaseInstance = createClient(url, key, {
    auth: {
      persistSession: false, // Prevents conflicts with NextAuth
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });

  console.log("[SUPABASE] Browser client initialized (Singleton)");
  return _supabaseInstance;
}
