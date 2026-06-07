/**
 * Unsubscribe API Route
 *
 * Handles email unsubscribe requests via GET.
 * CAN-SPAM compliant one-click unsubscribe.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/admin-client';
import { validateUnsubscribeToken } from '@/lib/always-on/unsubscribe';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get('token');
  const email = searchParams.get('email');
  const orgId = searchParams.get('orgId');

  // Validate required parameters
  if (!token || !email || !orgId) {
    return new NextResponse(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invalid Unsubscribe Link</title>
          <style>
            body { font-family: 'Jost', sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            h1 { color: #162944; }
          </style>
        </head>
        <body>
          <h1>Invalid Unsubscribe Link</h1>
          <p>This unsubscribe link is missing required parameters.</p>
          <p>Please contact support if you continue to receive unwanted emails.</p>
        </body>
      </html>
      `,
      { status: 400, headers: { 'Content-Type': 'text/html' } }
    );
  }

  // Validate token
  const isValid = validateUnsubscribeToken(token, email, orgId);

  if (!isValid) {
    return new NextResponse(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invalid Unsubscribe Token</title>
          <style>
            body { font-family: 'Jost', sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            h1 { color: #162944; }
          </style>
        </head>
        <body>
          <h1>Invalid Unsubscribe Token</h1>
          <p>This unsubscribe link is invalid or has expired.</p>
          <p>Please contact support if you continue to receive unwanted emails.</p>
        </body>
      </html>
      `,
      { status: 401, headers: { 'Content-Type': 'text/html' } }
    );
  }

  // Update notification preferences
  try {
    // Check if user has existing preferences
    const { data: existing } = await supabaseAdmin
      .from('notification_subscriptions')
      .select('*')
      .eq('org_id', orgId)
      .eq('user_email', email)
      .single();

    if (existing) {
      // Update existing subscription
      await supabaseAdmin
        .from('notification_subscriptions')
        .update({
          subscribed: false,
          updated_at: new Date().toISOString(),
        })
        .eq('org_id', orgId)
        .eq('user_email', email);
    } else {
      // Create new subscription record (unsubscribed)
      await supabaseAdmin
        .from('notification_subscriptions')
        .insert({
          org_id: orgId,
          user_email: email,
          notification_type: 'all',
          subscribed: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
    }

    return new NextResponse(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Unsubscribed Successfully</title>
          <style>
            body {
              font-family: 'Jost', sans-serif;
              max-width: 600px;
              margin: 50px auto;
              padding: 20px;
              text-align: center;
            }
            h1 { color: #162944; font-family: 'Lora', Georgia, serif; }
            p { color: #6b7280; line-height: 1.6; }
            .email { color: #1f2937; font-weight: 600; }
            a {
              display: inline-block;
              margin-top: 20px;
              padding: 12px 24px;
              background: #2E6BA8;
              color: #ffffff;
              text-decoration: none;
              font-weight: 600;
            }
            a:hover { background: #1f4f7a; }
          </style>
        </head>
        <body>
          <h1>Unsubscribed Successfully</h1>
          <p>You have been unsubscribed from Refyne email notifications.</p>
          <p class="email">${email}</p>
          <p>You can manage your notification preferences anytime in your account settings.</p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/settings">Go to Settings</a>
        </body>
      </html>
      `,
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    );
  } catch (error) {
    console.error('[Unsubscribe] Database error:', error);

    return new NextResponse(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Error</title>
          <style>
            body { font-family: 'Jost', sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            h1 { color: #dc2626; }
          </style>
        </head>
        <body>
          <h1>Error Processing Request</h1>
          <p>We encountered an error while processing your unsubscribe request.</p>
          <p>Please try again or contact support.</p>
        </body>
      </html>
      `,
      { status: 500, headers: { 'Content-Type': 'text/html' } }
    );
  }
}

/**
 * POST handler for programmatic unsubscribe (List-Unsubscribe-Post)
 */
export async function POST(request: NextRequest) {
  // Same logic as GET for RFC 8058 List-Unsubscribe-Post
  return GET(request);
}
