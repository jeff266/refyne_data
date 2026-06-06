/**
 * Audit Log - Fire-and-Forget Logger
 *
 * Non-blocking audit trail for compliance and debugging.
 * Uses supabaseAdmin (service role) to bypass RLS.
 * Errors logged to console only - Sentry global handler picks them up passively.
 */

import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/db/admin-client';
import type { AuditAction } from './actions';

interface AuditEventParams {
  orgId: string;
  actorId: string;
  actorEmail?: string;
  action: AuditAction;
  objectType?: string;
  objectId?: string;
  objectLabel?: string;
  beforeState?: Record<string, any>;
  afterState?: Record<string, any>;
  metadata?: Record<string, any>;
  request?: NextRequest;
}

/**
 * Sanitize objects for JSON storage
 * Handles bigints, Dates, undefined values
 */
function sanitizeForJson(obj: any): any {
  if (obj === null || obj === undefined) return null;

  return JSON.parse(
    JSON.stringify(obj, (key, value) =>
      typeof value === 'bigint'
        ? value.toString()
        : value instanceof Date
        ? value.toISOString()
        : value === undefined
        ? null
        : value
    )
  );
}

/**
 * Extract IP address from Vercel-specific headers
 * Priority: x-vercel-forwarded-for > x-forwarded-for > x-real-ip
 */
function extractIpAddress(request?: NextRequest): string | null {
  if (!request) return null;

  return (
    request.headers.get('x-vercel-forwarded-for') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    null
  );
}

/**
 * Log audit event (fire-and-forget)
 * Returns void immediately - does not block execution
 */
export function logAuditEvent(params: AuditEventParams): void {
  void (async () => {
    try {
      const {
        orgId,
        actorId,
        actorEmail,
        action,
        objectType,
        objectId,
        objectLabel,
        beforeState,
        afterState,
        metadata,
        request,
      } = params;

      const { error } = await supabaseAdmin.from('audit_log').insert({
        org_id: orgId,
        actor_id: actorId,
        actor_email: actorEmail || null,
        user_agent: request?.headers.get('user-agent') || null,
        action,
        object_type: objectType || null,
        object_id: objectId || null,
        object_label: objectLabel || null,
        before_state: beforeState ? sanitizeForJson(beforeState) : null,
        after_state: afterState ? sanitizeForJson(afterState) : null,
        metadata: metadata ? sanitizeForJson(metadata) : null,
        ip_address: extractIpAddress(request),
      });

      if (error) {
        console.error('[Audit] Failed to log event:', error);
      }
    } catch (err) {
      console.error('[Audit] Exception during logging:', err);
      // No Sentry call here - global handler picks up console.error passively
    }
  })();
}
