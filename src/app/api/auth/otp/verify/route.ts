import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(req: Request) {
  try {
    const { phone, code } = await req.json();

    // 1. Simulation: Accept any 6-digit code for now (or a specific mock code)
    if (!code || code.length !== 6) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
    }

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    // 2. Find or create the user
    let user = await db.query.users.findFirst({
      where: eq(users.phone, phone),
    });

    if (!user) {
      // Create a placeholder user for phone-only login
      const [newUser] = await db.insert(users).values({
        phone: phone,
        email: `${phone.replace('+', '')}@dealcollab.ai`, // Unique placeholder email
        isPhoneVerified: true,
        source: 'web',
      }).returning();
      user = newUser;
    } else {
      // Ensure existing user is marked as verified
      await db.update(users)
        .set({ isPhoneVerified: true })
        .where(eq(users.id, user.id));
    }

    return NextResponse.json({ success: true, phone: user.phone });
  } catch (error: unknown) {
    console.error("FULL ERROR:", error);
    console.error("STRINGIFIED:", JSON.stringify(error, null, 2));
    const errorMessage = error instanceof Error ? error.message : (typeof error === 'string' ? error : JSON.stringify(error));
    return NextResponse.json({ error: errorMessage || 'Verification failed' }, { status: 500 });
  }
}
