import { createClient } from '@supabase/supabase-js';
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMatches() {
  console.log("Fetching the latest matches...");
  
  const { data, error } = await supabase
    .from('proposal_matches')
    .select(`
      id,
      match_score,
      match_reason,
      proposals!matched_proposal_id(intent, sectors, deal_size_min_cr)
    `)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error("Error fetching matches:", error.message);
    return;
  }

  console.log("\n✅ Found", data.length, "recent matches:\n");
  data.forEach((match, i) => {
    console.log(`[${i + 1}] Match Score: ${match.match_score}`);
      const proposal = match.proposals?.[0];
      console.log(`    Counterparty Intent: ${proposal?.intent}`);
      console.log(`    Counterparty Sectors: ${Array.isArray(proposal?.sectors) ? proposal.sectors?.join(', ') : proposal?.sectors}`);
      console.log(`    Reason: ${match.match_reason}\n`);
  });
}

checkMatches();
