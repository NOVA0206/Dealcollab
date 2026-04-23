'use server';

import { db } from "@/db";
import { users, verificationTokens } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { signIn } from "@/auth";

/**
 * MOCK WHATSAPP SENDER
 * In production, replace this with a call to Twilio or Meta Cloud API
 */
import { sendWhatsAppOTP as realSendWhatsAppOTP } from "@/lib/whatsapp";

import { auth } from "@/auth";
import { sql } from "drizzle-orm";

/**
 * SURGICAL DATABASE FIX
 * Run this to fix the ON CONFLICT (identifier) error permanently.
 */
export async function fixDatabaseConstraint() {
  try {
    // 1. Clear out potentially conflicting data
    await db.execute(sql`DELETE FROM "verification_tokens"`);
    
    // 2. Drop existing constraint if it exists (standard Drizzle/NextAuth names)
    try {
      await db.execute(sql`ALTER TABLE "verification_tokens" DROP CONSTRAINT IF EXISTS "verification_tokens_pkey" CASCADE`);
    } catch {}
    
    // 3. Add the unique constraint required by the UPSERT logic
    await db.execute(sql`ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_identifier_unique" UNIQUE ("identifier")`);
    
    return { success: true };
  } catch (error) {
    console.error("DB FIX ERROR:", error);
    return { error: error instanceof Error ? error.message : "Internal database repair error" };
  }
}


