const { Client } = require('pg');

const connectionString = 'postgresql://postgres.qnxeyhdtrjdlqtjgwmnx:Jeevan%400206@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres';

async function fixSchema() {
  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    
    console.log('Adding is_phone_verified column to users table...');
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS is_phone_verified TEXT DEFAULT 'false';
    `);
    
    console.log('Successfully updated users table.');
  } catch (err) {
    console.error('Error updating schema:', err);
  } finally {
    await client.end();
  }
}

fixSchema();
