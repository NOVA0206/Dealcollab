import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  await client.connect();
  
  const targetUserId = '6fa06d21-c203-4935-a6c0-dc248638f241';
  
  try {
    console.log('=== VERIFICATION: API QUERY SIMULATION ===\n');

    // 1. Get another active user to check isolation
    const otherUserRes = await client.query(`
      SELECT id, email, name 
      FROM users 
      WHERE id != $1 
      LIMIT 1
    `, [targetUserId]);

    const otherUser = otherUserRes.rows[0];
    const otherUserId = otherUser ? otherUser.id : null;
    
    console.log(`Target User ID: ${targetUserId} (dealcollab.advisory@gmail.com)`);
    if (otherUser) {
      console.log(`Other User ID for Isolation Check: ${otherUserId} (${otherUser.email})`);
    } else {
      console.log('No other user found in database to compare.');
    }

    // 2. Simulating /api/deals/bulk for target user
    const bulkTargetRes = await client.query(`
      SELECT id, source, status, user_id
      FROM proposals
      WHERE user_id = $1
        AND status = 'ACTIVE'
        AND source = 'bulk_upload'
    `, [targetUserId]);

    console.log(`\n[API SIMULATION] GET /api/deals/bulk for Target User:`);
    console.log(`  - Mandates returned: ${bulkTargetRes.rowCount}`);
    const nonTargetBulk = bulkTargetRes.rows.filter(r => r.user_id !== targetUserId);
    console.log(`  - Mandates belonging to other users: ${nonTargetBulk.length}`);

    // 3. Simulating /api/deals/bulk for other user
    if (otherUserId) {
      const bulkOtherRes = await client.query(`
        SELECT id, source, status, user_id
        FROM proposals
        WHERE user_id = $1
          AND status = 'ACTIVE'
          AND source = 'bulk_upload'
      `, [otherUserId]);

      console.log(`\n[API SIMULATION] GET /api/deals/bulk for Other User:`);
      console.log(`  - Mandates returned: ${bulkOtherRes.rowCount}`);
      const targetUserBulkInOther = bulkOtherRes.rows.filter(r => r.user_id === targetUserId);
      console.log(`  - Mandates belonging to Target User: ${targetUserBulkInOther.length}`);
    }

    // 4. Simulating /api/deals (Chat Mandates) for target user
    const chatTargetRes = await client.query(`
      SELECT id, source, status, user_id
      FROM proposals
      WHERE user_id = $1
        AND status = 'ACTIVE'
        AND source != 'bulk_upload'
    `, [targetUserId]);

    console.log(`\n[API SIMULATION] GET /api/deals (Chat Mandates) for Target User:`);
    console.log(`  - Mandates returned: ${chatTargetRes.rowCount}`);
    const bulkInChat = chatTargetRes.rows.filter(r => r.source === 'bulk_upload');
    console.log(`  - Mandates with source='bulk_upload': ${bulkInChat.length}`);

    // 5. Total counts check for target user
    const totalBulkUserRes = await client.query(`
      SELECT status, COUNT(*) as count
      FROM proposals
      WHERE user_id = $1
        AND source = 'bulk_upload'
      GROUP BY status
    `, [targetUserId]);
    
    console.log(`\n[DATABASE CHECK] Total bulk-uploaded proposals in DB for target user:`);
    totalBulkUserRes.rows.forEach(r => {
      console.log(`  - Status: ${r.status} | Count: ${r.count}`);
    });

  } finally {
    await client.end();
  }
}

main().catch(console.error);
