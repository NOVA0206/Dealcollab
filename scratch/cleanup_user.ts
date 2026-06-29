import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  await client.connect();
  const email = 'dealcollab.advisory@gmail.com';
  
  try {
    const res = await client.query(`
      DELETE FROM users
      WHERE email = $1
    `, [email]);

    console.log(`Deleted ${res.rowCount} mock user rows.`);

  } finally {
    await client.end();
  }
}

main().catch(console.error);
