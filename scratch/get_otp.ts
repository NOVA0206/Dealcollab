import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  await client.connect();
  const email = 'dhiraj.ostwal@gmail.com';
  
  try {
    const res = await client.query(`
      SELECT otp_code, otp_expires
      FROM users
      WHERE email = $1
    `, [email]);

    const row = res.rows[0];
    if (!row) {
      console.log(`User ${email} not found.`);
      return;
    }

    console.log('\n--- OTP Code from Database ---');
    console.log(`OTP Code: ${row.otp_code}`);
    console.log(`Expires At: ${row.otp_expires?.toISOString()}`);
    console.log('------------------------------\n');

  } finally {
    await client.end();
  }
}

main().catch(console.error);
