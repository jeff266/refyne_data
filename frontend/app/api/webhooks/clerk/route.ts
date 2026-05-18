import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { Webhook } from 'svix';
import { seedDefaultSubscriptions } from '@/lib/notifications/seed-defaults';

/**
 * POST /api/webhooks/clerk
 *
 * Handles Clerk webhook events:
 * - organizationMembership.created: Seed default notification subscriptions
 */
export async function POST(request: NextRequest) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error('[Clerk Webhook] CLERK_WEBHOOK_SECRET not configured');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  // Get headers
  const headerPayload = headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 });
  }

  // Get body
  const payload = await request.json();
  const body = JSON.stringify(payload);

  // Verify webhook signature
  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: any;

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    });
  } catch (err) {
    console.error('[Clerk Webhook] Error verifying webhook:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Handle events
  const eventType = evt.type;

  if (eventType === 'organizationMembership.created') {
    const { organization, public_user_data } = evt.data;

    const orgId = organization.id;
    const userId = public_user_data.user_id;
    const userEmail = public_user_data.identifier || '';
    const role = evt.data.role;

    console.log(`[Clerk Webhook] Member joined: ${userEmail} as ${role} in org ${orgId}`);

    // Seed default notification subscriptions
    await seedDefaultSubscriptions(orgId, userId, userEmail, role);

    return NextResponse.json({ message: 'Subscriptions seeded' });
  }

  // Acknowledge other events
  return NextResponse.json({ message: 'Event received' });
}
