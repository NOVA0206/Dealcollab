import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(req: Request) {
  console.log('[OTP SEND] ▶ Route handler entered');

  try {
    const { email } = await req.json();
    console.log('[OTP SEND] email:', email);

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      console.warn('[OTP SEND] Validation failed — not a valid email:', email);
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const otp = generateOTP();
    console.log('[OTP SEND] OTP generated for:', normalizedEmail);

    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, normalizedEmail),
    });
    console.log('[OTP SEND] DB lookup — existing user found:', !!existingUser);

    if (existingUser) {
      await db.update(users)
        .set({ otpCode: otp, otpExpires, otpAttempts: 0 })
        .where(eq(users.id, existingUser.id));
      console.log('[OTP SEND] DB updated — OTP written to existing user');
    } else {
      await db.insert(users).values({
        email: normalizedEmail,
        otpCode: otp,
        otpExpires,
        otpAttempts: 0,
        source: 'web',
      });
      console.log('[OTP SEND] DB insert — new user row created');
    }

    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.BREVO_SENDER_EMAIL;

    if (!apiKey || !senderEmail) {
      console.error('[BREVO] Missing BREVO_API_KEY or BREVO_SENDER_EMAIL');
      return NextResponse.json({ error: 'Email service not configured' }, { status: 500 });
    }

    console.log('[BREVO] Sending OTP email via Brevo to:', normalizedEmail);

    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: { email: senderEmail, name: 'DealCollab AI' },
        to: [{ email: normalizedEmail }],
        subject: 'Your DealCollab Login Code',
        htmlContent: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 420px; margin: 0 auto; padding: 40px 32px; background: #ffffff; border-radius: 20px; border: 1px solid #E5E7EB;">
            <h2 style="color: #1F2937; font-size: 18px; font-weight: 800; margin: 0 0 4px 0;">DealCollab AI</h2>
            <p style="color: #9CA3AF; font-size: 11px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; margin: 0 0 28px 0;">India's M&A Intelligence Network</p>
            <p style="color: #6B7280; font-size: 14px; margin: 0 0 20px 0;">Your one-time verification code:</p>
            <div style="background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 14px; padding: 24px; text-align: center; margin-bottom: 24px;">
              <span style="font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #1F2937; font-variant-numeric: tabular-nums;">${otp}</span>
            </div>
            <p style="color: #9CA3AF; font-size: 12px; margin: 0;">Expires in 10 minutes &nbsp;·&nbsp; Do not share this code</p>
          </div>
        `,
        textContent: `Your DealCollab verification code is: ${otp}\n\nThis code expires in 10 minutes. Do not share it with anyone.`,
      }),
    });

    console.log('[BREVO] Response status:', brevoRes.status);

    if (brevoRes.status !== 201) {
      const brevoBody = await brevoRes.json().catch(() => ({}));
      console.error('[BREVO] Delivery failed:', brevoBody);
      return NextResponse.json({ error: 'Failed to send email. Please try again.' }, { status: 502 });
    }

    console.log('[BREVO] Email sent successfully');
    return NextResponse.json({ success: true });

  } catch (error: unknown) {
    console.error('[OTP SEND] ERROR:', error);
    const message = error instanceof Error ? error.message : 'Failed to send OTP';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
