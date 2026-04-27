import { createClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client using the Service Role Key.
 * This bypasses RLS and is safe to use ONLY in API routes (never in client code).
 * Used for operations that require elevated permissions like storage uploads.
 */
export function createServerSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error(
      "SERVER SUPABASE CONFIG MISSING: Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local"
    );
    return null;
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
