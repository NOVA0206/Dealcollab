import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(req: Request) {
  try {
    const { phone } = await req.json();

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    // Auto-format phone
    const cleanedPhone = phone.replace(/[^\d+]/g, '');
    const formattedPhone = cleanedPhone.startsWith('+') ? cleanedPhone : `+91${cleanedPhone}`;

    // Check if user already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.phone, formattedPhone),
    });

    if (existingUser) {
      return NextResponse.json({ 
        success: true, 
        message: 'User already exists', 
        user: existingUser 
      });
    }

    // Create WhatsApp user placeholder
    const [newUser] = await db.insert(users).values({
      email: `${formattedPhone.replace(/\D/g, '')}@dealcollab.ai`, // Unique placeholder
      phone: formattedPhone,
      isPhoneVerified: true, // WhatsApp inherently verifies phone
      source: 'whatsapp',
    }).returning();

    return NextResponse.json({ success: true, user: newUser });
  } catch (error) {
    console.error('WhatsApp Webhook Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
