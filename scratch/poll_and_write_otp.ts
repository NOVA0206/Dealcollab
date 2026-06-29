import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  await client.connect();
  const email = 'dhiraj.ostwal@gmail.com';
  const sharedFilePath = 'C:\\Users\\Nova\\.gemini\\antigravity-ide\\scratch\\otp.txt';
  
  try {
    console.log(`Polling database for new OTP for user ${email}...`);
    
    // Get initial OTP
    const initialRes = await client.query(`
      SELECT otp_code, otp_expires
      FROM users
      WHERE email = $1
    `, [email]);
    
    const initialOtp = initialRes.rows[0]?.otp_code;
    console.log(`Initial OTP: ${initialOtp}`);

    // Poll in a loop
    const startTime = Date.now();
    const timeout = 60000; // 60s timeout
    
    while (Date.now() - startTime < timeout) {
      const checkRes = await client.query(`
        SELECT otp_code, otp_expires
        FROM users
        WHERE email = $1
      `, [email]);
      
      const currentOtp = checkRes.rows[0]?.otp_code;
      if (currentOtp && currentOtp !== initialOtp) {
        console.log(`New OTP found: ${currentOtp}`);
        fs.writeFileSync(sharedFilePath, currentOtp, 'utf8');
        console.log(`Wrote OTP to ${sharedFilePath}`);
        return;
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('Timeout reached, no new OTP found.');
  } finally {
    await client.end();
  }
}

main().catch(console.error);
