import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function main() {
  const { data: users, error } = await supabase
    .from("users")
    .select("id, email, name")
    .eq("email", "jeevanj020604@gmail.com");

  if (error) {
    console.error(error);
  } else {
    console.log("Users found with email jeevanj020604@gmail.com:", users);
  }
}

main().catch(console.error);
