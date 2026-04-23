import { db } from "@/db";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    console.log('API: Running database migration to merge Profile into Users...');
    
    // 1. Extend Users table
    await db.execute(sql`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS firm_name TEXT,
      ADD COLUMN IF NOT EXISTS role TEXT,
      ADD COLUMN IF NOT EXISTS category TEXT[],
      ADD COLUMN IF NOT EXISTS custom_category TEXT,
      ADD COLUMN IF NOT EXISTS base_location TEXT,
      ADD COLUMN IF NOT EXISTS geographies TEXT[],
      ADD COLUMN IF NOT EXISTS cross_border BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS corridors TEXT,
      ADD COLUMN IF NOT EXISTS sectors TEXT[],
      ADD COLUMN IF NOT EXISTS intent TEXT,
      ADD COLUMN IF NOT EXISTS priority_sectors TEXT[],
      ADD COLUMN IF NOT EXISTS co_advisory BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS collaboration_model TEXT[],
      ADD COLUMN IF NOT EXISTS additional_info TEXT;
    `);

    // 2. Drop user_profiles table (CLEANUP)
    await db.execute(sql`DROP TABLE IF EXISTS user_profiles CASCADE;`);
    
    return NextResponse.json({ 
      success: true, 
      message: "Database migration successful: Users table extended and user_profiles table dropped." 
    });
  } catch (error: any) {
    console.error('API: Migration failed:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
