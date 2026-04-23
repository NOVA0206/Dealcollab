import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    console.log('🚀 Creating token_transactions table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS token_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        action TEXT NOT NULL,
        amount INTEGER NOT NULL,
        balance_after INTEGER NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );
    `);
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS token_transactions_user_id_idx ON token_transactions(user_id);`);
    
    return NextResponse.json({ success: true, message: 'Table created successfully' });
  } catch (error: any) {
    console.error('❌ Migration failed:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
