import pg from 'pg';
import dotenv from 'dotenv';
import { executeMatchmaking } from '../src/lib/matchmakingEngine';

dotenv.config();

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  await client.connect();
  const userId = '6fa06d21-c203-4935-a6c0-dc248638f241';
  
  try {
    console.log('Fetching an ACTIVE bulk_upload proposal...');
    const res = await client.query(`
      SELECT id, mandate_id, user_id, intent, raw_text, sectors, geographies, deal_structure,
             deal_size_min_cr, deal_size_max_cr, revenue_min_cr, revenue_max_cr, special_conditions
      FROM proposals
      WHERE user_id = $1
        AND source = 'bulk_upload'
        AND status = 'ACTIVE'
      LIMIT 1
    `, [userId]);

    const proposal = res.rows[0];
    if (!proposal) {
      console.log('No ACTIVE bulk_upload proposal found.');
      return;
    }

    console.log(`Found Proposal ID: ${proposal.id}`);
    console.log(`  - Intent: ${proposal.intent}`);
    console.log(`  - Sector: ${proposal.sectors?.[0]}`);
    console.log(`  - Geo: ${proposal.geographies?.[0]}`);
    
    // Clear any existing matches for this proposal first
    console.log(`Clearing existing matches for proposal ${proposal.id}...`);
    const delRes = await client.query(`
      DELETE FROM proposal_matches WHERE proposal_id = $1
    `, [proposal.id]);
    console.log(`Cleared ${delRes.rowCount} matches.`);

    // Run matchmaking
    console.log('Invoking executeMatchmaking...');
    const result = await executeMatchmaking({
      id: proposal.id,
      mandateId: proposal.mandate_id,
      userId: proposal.user_id,
      intent: proposal.intent,
      raw_text: proposal.raw_text || '',
      sector: proposal.sectors?.[0] ?? null,
      sub_sector: null,
      geography: proposal.geographies?.[0] ?? null,
      deal_size: null,
      revenue: null,
      structure: proposal.deal_structure ?? null,
      intent_focus: null,
      industry_data: {},
      special_conditions: proposal.special_conditions || [],
      deal_size_min: proposal.deal_size_min_cr?.toString() ?? null,
      deal_size_max: proposal.deal_size_max_cr?.toString() ?? null,
      revenue_min: proposal.revenue_min_cr?.toString() ?? null,
      revenue_max: proposal.revenue_max_cr?.toString() ?? null,
    });

    console.log('\n--- Matchmaking Result ---');
    console.log(JSON.stringify(result, null, 2));

    // Verify database entries in proposal_matches
    const matchesRes = await client.query(`
      SELECT id, matched_proposal_id, final_score, similarity_score, match_archetype, match_reason
      FROM proposal_matches
      WHERE proposal_id = $1
      ORDER BY final_score DESC
    `, [proposal.id]);

    console.log(`\nVerified database matches count: ${matchesRes.rowCount}`);
    matchesRes.rows.forEach((m, idx) => {
      console.log(`[${idx+1}] Match ID: ${m.id} | Matched To: ${m.matched_proposal_id}`);
      console.log(`    Score: ${m.final_score} | Archetype: ${m.match_archetype}`);
      try {
        const parsed = JSON.parse(m.match_reason);
        console.log(`    Reason Summary: ${parsed.reason?.split('\n')?.[0] || 'N/A'}`);
      } catch {
        console.log(`    Reason Raw: ${m.match_reason?.slice(0, 100)}...`);
      }
    });

  } finally {
    await client.end();
  }
}

main().catch(console.error);
