import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  await client.connect();
  
  try {
    // 1. Query columns of proposals
    console.log("--- COLUMNS OF TABLE proposals ---");
    const colsRes = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'proposals'
      ORDER BY ordinal_position;
    `);
    console.table(colsRes.rows);

    // 2. Query foreign keys on proposals
    console.log("--- FOREIGN KEYS ON TABLE proposals ---");
    const fkRes = await client.query(`
      SELECT
          tc.table_schema, 
          tc.constraint_name, 
          tc.table_name, 
          kcu.column_name, 
          ccu.table_schema AS foreign_table_schema,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name 
      FROM 
          information_schema.table_constraints AS tc 
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name='proposals';
    `);
    console.table(fkRes.rows);

    // 3. Query a few proposals referencing valid mandates
    console.log("--- PROPOSALS WITH VALID MANDATE COUPLING ---");
    const validRes = await client.query(`
      SELECT p.id, p.mandate_id
      FROM proposals p
      INNER JOIN mandates m ON p.mandate_id = m.id
      LIMIT 5;
    `);
    console.log(`Found ${validRes.rowCount} proposals with valid mandates`);
    if (validRes.rowCount && validRes.rowCount > 0) {
      console.table(validRes.rows);
    }
  } finally {
    await client.end();
  }
}

main().catch(console.error);
