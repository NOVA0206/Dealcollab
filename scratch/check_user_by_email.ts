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
      SELECT id, email, phone, otp_code, otp_expires
      FROM users
      WHERE email LIKE '%advisory%' OR email LIKE '%dealcollab%'
    `);

    console.log('--- Users Matching Email Pattern ---');
    console.table(res.rows);

  } finally {
    await client.end();
  }
}

main().catch(console.error);
