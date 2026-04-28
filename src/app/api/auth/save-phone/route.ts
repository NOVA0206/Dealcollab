import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';

export async function POST(req: Request) {
  try {
    const { phone } = await req.json();

    if (!phone || phone.length < 10) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
    }

    const session = await auth();
    console.log("Session:", session);
    console.log("Phone being saved:", phone);

    if (!session?.user?.id) {
       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if phone is already used by another account
    const existingUser = await db.query.users.findFirst({
      where: eq(users.phone, phone),
    });

    if (existingUser && existingUser.id !== session.user.id) {
       // Allow overriding if it's just a placeholder, otherwise block
       const isPlaceholder = existingUser.email?.includes('@dealcollab.ai');
       if (isPlaceholder) {
          await db.delete(users).where(eq(users.id, existingUser.id));
       } else {
          return NextResponse.json({ error: 'This phone number is already linked to another account.' }, { status: 403 });
       }
    }

    // Update the current user
    await db.update(users)
      .set({ 
        phone: phone,
        isPhoneVerified: true,
      })
      .where(eq(users.id, session.user.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Save Phone Route Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
