import { NextRequest, NextResponse } from 'next/server';
import { rateLimiters, checkRateLimit } from '@/lib/api/rate-limit';

/**
 * POST /api/support/contact
 *
 * Public support contact form submission.
 * Rate limited to 3 requests per hour per IP.
 * Sends email via Resend to support team.
 */
export async function POST(req: NextRequest) {
  try {
    // Get client IP for rate limiting
    const ip = req.headers.get('x-forwarded-for') ||
               req.headers.get('x-real-ip') ||
               'unknown';

    // Check rate limit (3 per hour per IP)
    const rateLimitError = await checkRateLimit(rateLimiters.supportContact, ip);
    if (rateLimitError) {
      return rateLimitError;
    }

    // Parse and validate request body
    const body = await req.json();
    const { name, email, subject, message } = body;

    if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    // Check if Resend is configured
    if (!process.env.RESEND_API_KEY) {
      console.error('[Support Contact] RESEND_API_KEY not configured');
      return NextResponse.json(
        { error: 'Email service not configured' },
        { status: 500 }
      );
    }

    // Lazy-load Resend
    let Resend: any;
    try {
      Resend = (await import('resend')).Resend;
    } catch (error) {
      console.error('[Support Contact] Resend package not installed:', error);
      return NextResponse.json(
        { error: 'Email service not available' },
        { status: 500 }
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    // Send email
    const emailBody = `Name: ${name}
Email: ${email}
Subject: ${subject}

Message:
${message}`;

    await resend.emails.send({
      from: 'Refyne Support <hello@refynedata.com>',
      to: 'jeff@revopsimpact.us',
      subject: `[Refyne Support] ${subject}`,
      text: emailBody,
      replyTo: email, // Allow direct reply to the user
    });

    console.log(`✅ Support message sent from ${email} (IP: ${ip})`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Support Contact] Error:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
