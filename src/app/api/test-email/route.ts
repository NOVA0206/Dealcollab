// TEMPORARY DEVELOPMENT TEST ROUTE
// Purpose: Verify Brevo API key + sender email + delivery to inbox
// Do NOT integrate with authentication, OTP system, or any existing code.
// Remove this file before deploying to production.

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;

  // --- Validate env vars ---
  if (!apiKey) {
    console.error('[test-email] BREVO_API_KEY is missing');
    return NextResponse.json(
      { success: false, error: 'BREVO_API_KEY is not set in environment variables' },
      { status: 500 }
    );
  }
  if (!senderEmail) {
    console.error('[test-email] BREVO_SENDER_EMAIL is missing');
    return NextResponse.json(
      { success: false, error: 'BREVO_SENDER_EMAIL is not set in environment variables' },
      { status: 500 }
    );
  }

  console.log('[test-email] API Key detected:', apiKey.slice(0, 8) + '...');
  console.log('[test-email] Sender email detected:', senderEmail);

  const timestamp = new Date().toISOString();
  const recipient = '1272250031@mitwpu.edu.in';

  const payload = {
    sender: { email: senderEmail, name: 'DealCollab AI' },
    to: [{ email: recipient, name: 'Jeevan' }],
    subject: 'DealCollab Brevo Test Email',
    htmlContent: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 32px; background: #ffffff; border-radius: 16px; border: 1px solid #E5E7EB;">
        <h2 style="color: #1F2937; font-size: 18px; font-weight: 800; margin: 0 0 4px 0;">DealCollab AI</h2>
        <p style="color: #9CA3AF; font-size: 11px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; margin: 0 0 28px 0;">Email Infrastructure Test</p>
        <p style="color: #374151; font-size: 15px; margin: 0 0 12px 0;">Hello Jeevan,</p>
        <p style="color: #374151; font-size: 15px; margin: 0 0 12px 0;">If you received this email, Brevo is configured correctly.</p>
        <p style="color: #374151; font-size: 15px; font-weight: 700; margin: 0 0 28px 0;">DealCollab Email Infrastructure Test Successful.</p>
        <div style="background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 10px; padding: 16px 20px;">
          <p style="color: #9CA3AF; font-size: 12px; margin: 0;">Timestamp: <span style="color: #1F2937; font-weight: 600;">${timestamp}</span></p>
        </div>
      </div>
    `,
    textContent: `Hello Jeevan,\n\nIf you received this email, Brevo is configured correctly.\n\nDealCollab Email Infrastructure Test Successful.\n\nTimestamp: ${timestamp}`,
  };

  console.log('[test-email] Sending email to:', recipient);

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log('[test-email] Brevo response status:', response.status);

    const body = await response.json().catch(() => ({}));

    if (response.status === 201) {
      console.log('[test-email] Delivery result: SUCCESS — messageId:', body.messageId);
      return NextResponse.json({
        success: true,
        message: 'Test email sent',
        brevoStatus: 201,
        messageId: body.messageId ?? null,
        sentTo: recipient,
        timestamp,
      });
    }

    console.error('[test-email] Delivery result: FAILED —', body);
    return NextResponse.json(
      {
        success: false,
        error: body?.message ?? `Brevo returned HTTP ${response.status}`,
        brevoStatus: response.status,
        brevoBody: body,
      },
      { status: 502 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[test-email] Network/fetch error:', message);
    return NextResponse.json(
      { success: false, error: `Network error: ${message}` },
      { status: 500 }
    );
  }
}
