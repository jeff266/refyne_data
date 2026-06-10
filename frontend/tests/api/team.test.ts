/**
 * Team Management API Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock dependencies
const mockRequireAdmin = vi.fn();
const mockAuthError = vi.fn();
const mockGetOrganizationMembershipList = vi.fn();
const mockUpdateOrganizationMembership = vi.fn();
const mockDeleteOrganizationMembership = vi.fn();
const mockGetOrganizationInvitationList = vi.fn();
const mockRevokeOrganizationInvitation = vi.fn();
const mockCreateOrganizationInvitation = vi.fn();

vi.mock('@/lib/auth/clerk-helpers', () => ({
  requireAdmin: () => mockRequireAdmin(),
  authError: (e: any) => mockAuthError(e),
}));

vi.mock('@clerk/nextjs/server', () => ({
  clerkClient: {
    organizations: {
      getOrganizationMembershipList: (...args: any[]) => mockGetOrganizationMembershipList(...args),
      updateOrganizationMembership: (...args: any[]) => mockUpdateOrganizationMembership(...args),
      deleteOrganizationMembership: (...args: any[]) => mockDeleteOrganizationMembership(...args),
      getOrganizationInvitationList: (...args: any[]) => mockGetOrganizationInvitationList(...args),
      revokeOrganizationInvitation: (...args: any[]) => mockRevokeOrganizationInvitation(...args),
      createOrganizationInvitation: (...args: any[]) => mockCreateOrganizationInvitation(...args),
    },
  },
}));

// Import routes after mocking
import { GET as GET_MEMBERS } from '@/app/api/team/members/route';
import { PATCH as PATCH_MEMBER, DELETE as DELETE_MEMBER } from '@/app/api/team/members/[userId]/route';
import { GET as GET_INVITATIONS } from '@/app/api/team/invitations/route';
import { DELETE as DELETE_INVITATION } from '@/app/api/team/invitations/[invitationId]/route';
import { POST as POST_INVITE } from '@/app/api/team/invite/route';

describe('Team Management API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({
      orgId: 'org_test123',
      userId: 'user_admin',
    });
  });

  describe('GET /api/team/members', () => {
    it('returns org members', async () => {
      const mockMemberships = [
        {
          publicUserData: {
            userId: 'user_1',
            identifier: 'alice@example.com',
            firstName: 'Alice',
            lastName: 'Admin',
          },
          role: 'org:admin',
          createdAt: 1609459200000, // 2021-01-01
        },
        {
          publicUserData: {
            userId: 'user_2',
            identifier: 'bob@example.com',
            firstName: 'Bob',
            lastName: 'Member',
          },
          role: 'org:member',
          createdAt: 1609545600000, // 2021-01-02
        },
      ];

      mockGetOrganizationMembershipList.mockResolvedValue({
        data: mockMemberships,
      });

      const response = await GET_MEMBERS();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.members).toHaveLength(2);
      expect(data.members[0].email).toBe('alice@example.com');
      expect(data.members[0].role).toBe('org:admin');
      expect(data.members[1].email).toBe('bob@example.com');
      expect(data.members[1].role).toBe('org:member');
      expect(mockGetOrganizationMembershipList).toHaveBeenCalledWith({
        organizationId: 'org_test123',
      });
    });

    it('returns 403 for non-admin', async () => {
      mockRequireAdmin.mockRejectedValue(new Error('Forbidden'));
      mockAuthError.mockReturnValue(
        new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
      );

      const response = await GET_MEMBERS();
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });
  });

  describe('PATCH /api/team/members/[userId]', () => {
    it('updates member role successfully', async () => {
      const mockMemberships = [
        {
          publicUserData: { userId: 'user_admin' },
          role: 'org:admin',
        },
        {
          publicUserData: { userId: 'user_2' },
          role: 'org:member',
        },
      ];

      mockGetOrganizationMembershipList.mockResolvedValue({
        data: mockMemberships,
      });

      mockUpdateOrganizationMembership.mockResolvedValue({});

      const request = new NextRequest('http://localhost:3000/api/team/members/user_2', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'org:admin' }),
      });

      const response = await PATCH_MEMBER(request, { params: { userId: 'user_2' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockUpdateOrganizationMembership).toHaveBeenCalledWith({
        organizationId: 'org_test123',
        userId: 'user_2',
        role: 'org:admin',
      });
    });

    it('cannot demote last admin', async () => {
      const mockMemberships = [
        {
          publicUserData: { userId: 'user_admin' },
          role: 'org:admin',
        },
        {
          publicUserData: { userId: 'user_2' },
          role: 'org:member',
        },
      ];

      mockGetOrganizationMembershipList.mockResolvedValue({
        data: mockMemberships,
      });

      const request = new NextRequest('http://localhost:3000/api/team/members/user_admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'org:member' }),
      });

      const response = await PATCH_MEMBER(request, { params: { userId: 'user_other_admin' } });
      const data = await response.json();

      // First it checks if userId === ctx.userId
      // Since we're trying to demote user_other_admin (not user_admin), it passes that check
      // But when checking admin count, there's only 1 admin (user_admin)
      expect(response.status).toBe(400);
      expect(data.error).toContain('Cannot demote the last admin');
    });

    it('cannot change your own role', async () => {
      const request = new NextRequest('http://localhost:3000/api/team/members/user_admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'org:member' }),
      });

      const response = await PATCH_MEMBER(request, { params: { userId: 'user_admin' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Cannot change your own role');
    });
  });

  describe('DELETE /api/team/members/[userId]', () => {
    it('removes member successfully', async () => {
      const mockMemberships = [
        {
          publicUserData: { userId: 'user_admin' },
          role: 'org:admin',
        },
        {
          publicUserData: { userId: 'user_2' },
          role: 'org:member',
        },
      ];

      mockGetOrganizationMembershipList.mockResolvedValue({
        data: mockMemberships,
      });

      mockDeleteOrganizationMembership.mockResolvedValue({});

      const request = new NextRequest('http://localhost:3000/api/team/members/user_2', {
        method: 'DELETE',
      });

      const response = await DELETE_MEMBER(request, { params: { userId: 'user_2' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockDeleteOrganizationMembership).toHaveBeenCalledWith({
        organizationId: 'org_test123',
        userId: 'user_2',
      });
    });

    it('cannot remove yourself', async () => {
      const request = new NextRequest('http://localhost:3000/api/team/members/user_admin', {
        method: 'DELETE',
      });

      const response = await DELETE_MEMBER(request, { params: { userId: 'user_admin' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Cannot remove yourself from the organization');
    });
  });

  describe('GET /api/team/invitations', () => {
    it('returns pending invitations', async () => {
      const mockInvitations = [
        {
          id: 'inv_1',
          emailAddress: 'charlie@example.com',
          role: 'org:member',
          createdAt: 1609459200000,
        },
        {
          id: 'inv_2',
          emailAddress: 'diana@example.com',
          role: 'org:admin',
          createdAt: 1609545600000,
        },
      ];

      mockGetOrganizationInvitationList.mockResolvedValue({
        data: mockInvitations,
      });

      const response = await GET_INVITATIONS();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.invitations).toHaveLength(2);
      expect(data.invitations[0].emailAddress).toBe('charlie@example.com');
      expect(data.invitations[0].role).toBe('org:member');
      expect(mockGetOrganizationInvitationList).toHaveBeenCalledWith({
        organizationId: 'org_test123',
        status: ['pending'],
      });
    });
  });

  describe('DELETE /api/team/invitations/[invitationId]', () => {
    it('revokes invitation via Clerk API', async () => {
      mockRevokeOrganizationInvitation.mockResolvedValue({});

      const request = new NextRequest('http://localhost:3000/api/team/invitations/inv_123', {
        method: 'DELETE',
      });

      const response = await DELETE_INVITATION(request, { params: { invitationId: 'inv_123' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockRevokeOrganizationInvitation).toHaveBeenCalledWith({
        organizationId: 'org_test123',
        invitationId: 'inv_123',
        requestingUserId: 'user_admin',
      });
    });
  });

  describe('POST /api/team/invite', () => {
    it('creates Clerk invitation', async () => {
      mockCreateOrganizationInvitation.mockResolvedValue({});

      const request = new NextRequest('http://localhost:3000/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'eve@example.com',
          role: 'org:member',
        }),
      });

      const response = await POST_INVITE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.email).toBe('eve@example.com');
      expect(mockCreateOrganizationInvitation).toHaveBeenCalledWith({
        organizationId: 'org_test123',
        inviterUserId: 'user_admin',
        emailAddress: 'eve@example.com',
        role: 'org:member',
        redirectUrl: expect.stringContaining('/dashboard'),
      });
    });

    it('returns 403 for non-admin', async () => {
      mockRequireAdmin.mockRejectedValue(new Error('Forbidden'));
      mockAuthError.mockReturnValue(
        new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
      );

      const request = new NextRequest('http://localhost:3000/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'eve@example.com',
          role: 'org:member',
        }),
      });

      const response = await POST_INVITE(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });
  });
});
