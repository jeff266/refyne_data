/**
 * Unsubscribe Token Generation
 *
 * Generates and validates HMAC tokens for email unsubscribe links.
 */

import crypto from 'crypto';

/**
 * Generate an unsubscribe token for an email address and org.
 * Token = HMAC-SHA256(email + orgId, UNSUBSCRIBE_SECRET)
 */
export function generateUnsubscribeToken(email: string, orgId: string): string {
  const secret = process.env.UNSUBSCRIBE_SECRET || 'default-secret-change-me';
  const data = `${email}:${orgId}`;

  return crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex');
}

/**
 * Validate an unsubscribe token.
 * Returns true if the token is valid for the given email and org.
 */
export function validateUnsubscribeToken(
  token: string,
  email: string,
  orgId: string
): boolean {
  const expectedToken = generateUnsubscribeToken(email, orgId);
  return crypto.timingSafeEqual(
    Buffer.from(token),
    Buffer.from(expectedToken)
  );
}

/**
 * Build an unsubscribe URL for an email address.
 */
export function buildUnsubscribeUrl(email: string, orgId: string): string {
  const token = generateUnsubscribeToken(email, orgId);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://refyne.io';
  return `${baseUrl}/api/unsubscribe?token=${token}&email=${encodeURIComponent(email)}&orgId=${orgId}`;
}
