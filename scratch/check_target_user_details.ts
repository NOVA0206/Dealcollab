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
    const res = await client.query(`
      SELECT id, email, phone, otp_code, otp_expires
      FROM users
      WHERE id = $1
    `, [userId]);

    console.log('--- Target User Details ---');
    console.table(res.rows);

  } finally {
    await client.end();
  }
}

main().catch(console.error);
