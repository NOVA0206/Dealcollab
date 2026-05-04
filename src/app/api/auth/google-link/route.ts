import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, accounts } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { cookies } from 'next/headers';

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { google_id, email, name, image } = await req.json();

    if (!google_id || !email) {
      return NextResponse.json({ error: 'Google ID and Email are required' }, { status: 400 });
    }

    // Extract verified phone from the secure session cookie
    const cookieStore = await cookies();
    const verifiedPhone = cookieStore.get('verified_phone_session')?.value;

    // 1. Check if a user with this Google ID already exists
    const existingAccount = await db.query.accounts.findFirst({
        where: and(eq(accounts.provider, 'google'), eq(accounts.providerAccountId, google_id))
    });

    let targetUser = null;
    if (existingAccount) {
        targetUser = await db.query.users.findFirst({ where: eq(users.id, existingAccount.userId) });
    }

    // 2. Linking Logic
    if (verifiedPhone) {
      // Check if this phone is already linked to ANOTHER google_id
      const userByPhone = await db.query.users.findFirst({
        where: eq(users.phone, verifiedPhone)
      });

      if (userByPhone) {
        if (targetUser && userByPhone.id !== targetUser.id) {
          return NextResponse.json({ error: 'This number is already linked to another account' }, { status: 403 });
        }
        
        // CASE 2: Phone exists, but no Google ID linked yet
        if (!targetUser) {
           targetUser = userByPhone;
        }
      }
    }

    // 3. User Creation / Update
    if (!targetUser) {
      // CASE 3: New User
      const [newUser] = await db.insert(users).values({
        email: email,
        name: name,
        image: image,
        phone: verifiedPhone || null,
        isPhoneVerified: !!verifiedPhone,
      }).returning();
      
      targetUser = newUser;
    } else if (verifiedPhone && !targetUser.phone) {
      // CASE 2: Update existing Google user with verified phone
      await db.update(users)
        .set({ phone: verifiedPhone, isPhoneVerified: true })
        .where(eq(users.id, targetUser.id));
    }

    // 4. Link Google Account if not linked
    if (!existingAccount) {
        await db.insert(accounts).values({
            userId: targetUser.id,
            type: 'oauth',
            provider: 'google',
            providerAccountId: google_id,
        });
    }

    // Cleanup session cookie
    cookieStore.delete('verified_phone_session');

    return NextResponse.json({ success: true, user: targetUser });
  } catch (error: unknown) {
    console.error("FULL ERROR:", error);
    console.error("STRINGIFIED:", JSON.stringify(error, null, 2));
    const errorMessage = error instanceof Error ? error.message : (typeof error === 'string' ? error : JSON.stringify(error));
    return NextResponse.json({ error: errorMessage || 'Internal server error' }, { status: 500 });
  }
}

