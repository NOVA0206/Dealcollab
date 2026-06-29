import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  await client.connect();
  try {
    const res = await client.query(`
      SELECT id, embedding::text as embedding_str, embedding
      FROM proposals
      WHERE embedding IS NOT NULL
      LIMIT 1
    `);
    if (res.rowCount === 0) {
      console.log('No proposals with embeddings found');
    } else {
      const row = res.rows[0];
      console.log('ID:', row.id);
      console.log('Type of embedding_str:', typeof row.embedding_str);
      console.log('embedding_str preview:', row.embedding_str?.slice(0, 100));
      console.log('Type of embedding:', typeof row.embedding);
      console.log('embedding preview:', Array.isArray(row.embedding) ? row.embedding.slice(0, 5) : row.embedding);
    }
  } finally {
    await client.end();
  }
}

main().catch(console.error);
