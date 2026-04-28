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
  } catch (error) {
    console.error('OTP Verify Error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
