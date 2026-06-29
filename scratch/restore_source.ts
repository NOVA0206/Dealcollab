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
      UPDATE proposals
      SET source = 'bulk_upload'
      WHERE id = $1
    `, [proposalId]);

    console.log(`Updated ${res.rowCount} rows. Source restored to 'bulk_upload'.`);

  } finally {
    await client.end();
  }
}

main().catch(console.error);
