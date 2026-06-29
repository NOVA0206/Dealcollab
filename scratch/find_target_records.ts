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
    console.log(`Checking bulk_upload proposals for user ${userId}...`);
    
    // Check proposals where source = 'bulk_upload'
    const targetsRes = await client.query(`
      SELECT status, embedding_status, COUNT(*) as count,
             COUNT(summary_text) as count_with_summary,
             COUNT(embedding) as count_with_embedding,
             MIN(updated_at) as min_updated_at,
             MAX(updated_at) as max_updated_at
      FROM proposals
      WHERE user_id = $1
        AND source = 'bulk_upload'
      GROUP BY status, embedding_status
    `, [userId]);
    
    console.log('\n--- Count of bulk_upload proposals ---');
    console.table(targetsRes.rows);

    // Get a sample proposal details
    const sampleRes = await client.query(`
      SELECT id, source, status, embedding_status, summary_text::text as summary, raw_text::text as raw, updated_at
      FROM proposals
      WHERE user_id = $1
        AND source = 'bulk_upload'
      LIMIT 3
    `, [userId]);
    
    console.log('\n--- Sample bulk_upload proposals ---');
    sampleRes.rows.forEach((r, idx) => {
      console.log(`[${idx+1}] ID: ${r.id} | Status: ${r.status} | Embed Status: ${r.embedding_status} | Updated At: ${r.updated_at.toISOString()}`);
      console.log(`    Summary: ${r.summary ? r.summary.slice(0, 100) + '...' : '(null)'}`);
      console.log(`    Raw: ${r.raw ? r.raw.slice(0, 100) + '...' : '(null)'}`);
    });

  } finally {
    await client.end();
  }
}

main().catch(console.error);
