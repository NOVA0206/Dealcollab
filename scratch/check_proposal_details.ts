import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  await client.connect();
  const proposalId = '42b7d7ce-c92f-4a6d-817f-b7d248a28101';
  
  try {
    const res = await client.query(`
      SELECT id, user_id, source, status, intent, sectors, geographies, updated_at
      FROM proposals
      WHERE id = $1
    `, [proposalId]);

    console.log('--- Target Proposal Details ---');
    console.table(res.rows);

  } finally {
    await client.end();
  }
}

main().catch(console.error);
