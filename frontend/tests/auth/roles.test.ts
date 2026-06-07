/**
 * RBAC Roles Unit Tests
 *
 * Tests for the core RBAC role utility functions:
 * - requireAdmin() - Throws Response with 403 for non-admins
 * - isAdmin() - Returns boolean for admin check
 * - isMember() - Returns boolean for member check (admins are also members)
 */

import { describe, it, expect } from 'vitest';
import { requireAdmin, isAdmin, isMember } from '@/lib/auth/roles';
import type { OrgRole } from '@/lib/auth/roles';

describe('RBAC Roles', () => {
  describe('requireAdmin()', () => {
    it('does not throw when orgRole is org:admin', () => {
      const orgRole: OrgRole = 'org:admin';

      expect(() => requireAdmin(orgRole)).not.toThrow();
    });

    it('throws Response with 403 status when orgRole is org:member', () => {
      const orgRole: OrgRole = 'org:member';

      try {
        requireAdmin(orgRole);
        expect.fail('Expected requireAdmin to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        const response = error as Response;
        expect(response.status).toBe(403);
      }
    });

    it('throws Response with 403 status and admin_required error when orgRole is org:member', async () => {
      const orgRole: OrgRole = 'org:member';

      try {
        requireAdmin(orgRole);
        expect.fail('Expected requireAdmin to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        const response = error as Response;
        const body = await response.json();
        expect(body.error).toBe('admin_required');
        expect(body.message).toBe('This action requires admin access');
      }
    });

    it('throws Response with 403 status when orgRole is undefined', () => {
      const orgRole: OrgRole = undefined;

      try {
        requireAdmin(orgRole);
        expect.fail('Expected requireAdmin to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        const response = error as Response;
        expect(response.status).toBe(403);
      }
    });
  });

  describe('isAdmin()', () => {
    it('returns true when orgRole is org:admin', () => {
      const orgRole: OrgRole = 'org:admin';

      expect(isAdmin(orgRole)).toBe(true);
    });

    it('returns false when orgRole is org:member', () => {
      const orgRole: OrgRole = 'org:member';

      expect(isAdmin(orgRole)).toBe(false);
    });

    it('returns false when orgRole is undefined', () => {
      const orgRole: OrgRole = undefined;

      expect(isAdmin(orgRole)).toBe(false);
    });
  });

  describe('isMember()', () => {
    it('returns true when orgRole is org:admin (admins are also members)', () => {
      const orgRole: OrgRole = 'org:admin';

      expect(isMember(orgRole)).toBe(true);
    });

    it('returns true when orgRole is org:member', () => {
      const orgRole: OrgRole = 'org:member';

      expect(isMember(orgRole)).toBe(true);
    });

    it('returns false when orgRole is undefined', () => {
      const orgRole: OrgRole = undefined;

      expect(isMember(orgRole)).toBe(false);
    });
  });
});
