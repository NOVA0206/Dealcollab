import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  await client.connect();
  const userId = '6fa06d21-c203-4935-a6c0-dc248638f241';
  
  try {
    console.log('Simulating GET /api/deals/bulk for target user...');
    
    // Fetch proposals (exactly like the API)
    const { rows: proposalsRows } = await client.query(`
      SELECT id, intent, sectors, geographies, deal_size_min_cr, deal_size_max_cr, status, created_at, raw_text, normalised_text, summary_text, metadata, embedding_status
      FROM proposals
      WHERE user_id = $1
        AND status = 'ACTIVE'
        AND source = 'bulk_upload'
      ORDER BY created_at DESC
    `, [userId]);

    console.log(`Fetched ${proposalsRows.length} ACTIVE proposals.`);

    const targetProposalId = '42b7d7ce-c92f-4a6d-817f-b7d248a28101';
    const hasTarget = proposalsRows.some(p => p.id === targetProposalId);
    console.log(`Contains our test proposal (${targetProposalId}): ${hasTarget ? 'YES' : 'NO'}`);

    if (proposalsRows.length === 0) {
      console.log('No proposals returned by query.');
      return;
    }

    const proposalIds = proposalsRows.map(p => p.id);

    // Fetch matches (exactly like the API)
    // Note: Drizzle raw SQL with joins
    const matchesRes = await client.query(`
      SELECT 
        pm.id,
        pm.proposal_id,
        pm.similarity_score,
        pm.final_score,
        pm.match_reason,
        pm.matched_proposal_id,
        p.id as cp_id,
        p.intent as cp_intent,
        p.sectors as cp_sectors,
        p.geographies as cp_geographies,
        p.deal_size_min_cr as cp_deal_size_min_cr,
        p.deal_size_max_cr as cp_deal_size_max_cr,
        p.deal_structure as cp_deal_structure,
        p.raw_text as cp_raw_text,
        p.normalised_text as cp_normalised_text,
        p.summary_text as cp_summary_text,
        p.metadata as cp_metadata
      FROM proposal_matches pm
      LEFT JOIN proposals p ON pm.matched_proposal_id = p.id
      WHERE pm.proposal_id = ANY($1)
      ORDER BY pm.final_score DESC
    `, [proposalIds]);

    console.log(`Fetched ${matchesRes.rowCount} matches total.`);

    // Hydrate
    const hydrated = proposalsRows.map((proposal) => {
      const proposalMatches = matchesRes.rows
        .filter((m) => m.proposal_id === proposal.id)
        .map((m) => {
          return {
            id: m.id,
            score: m.final_score,
            similarity: m.similarity_score,
            reason: m.match_reason,
            matchedProposalId: m.matched_proposal_id,
            counterparty: m.cp_id
              ? {
                  intent: m.cp_intent,
                  sectors: m.cp_sectors,
                  geographies: m.cp_geographies,
                  size_min: m.cp_deal_size_min_cr,
                  size_max: m.cp_deal_size_max_cr,
                  raw_text: m.cp_raw_text,
                  normalised_text: m.cp_normalised_text,
                  summary_text: m.cp_summary_text ?? null,
                  mandate_summary: m.cp_metadata?.mandate_summary ?? null,
                }
              : null,
          };
        });

      return {
        ...proposal,
        matches: proposalMatches,
      };
    });

    const targetProposal = hydrated.find(p => p.id === targetProposalId);
    if (targetProposal) {
      console.log(`\nTarget proposal (${targetProposalId}) hydrated successfully:`);
      console.log(`  - Matches count: ${targetProposal.matches.length}`);
      if (targetProposal.matches.length > 0) {
        console.log(`  - Sample Match ID: ${targetProposal.matches[0].id}`);
        console.log(`  - Match Score: ${targetProposal.matches[0].score}`);
        console.log(`  - Match Counterparty Sector: ${targetProposal.matches[0].counterparty?.sectors?.[0]}`);
      }
    } else {
      console.log('Target proposal not found in hydrated array (status may not be ACTIVE).');
    }

  } finally {
    await client.end();
  }
}

main().catch(console.error);
