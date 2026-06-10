'use client';

import { useEffect, useState } from 'react';
import { C, F } from '@/lib/design-tokens';
import { useAuth, useUser } from '@clerk/nextjs';

interface Member {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'org:admin' | 'org:member';
  joinedAt: number;
}

interface Invitation {
  id: string;
  emailAddress: string;
  role: 'org:admin' | 'org:member';
  createdAt: number;
}

export function MembersTab() {
  const { orgRole } = useAuth();
  const { user } = useUser();
  const isAdmin = orgRole === 'org:admin';

  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'org:admin' | 'org:member'>('org:member');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  // Confirmation state
  const [confirmingRemove, setConfirmingRemove] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    await Promise.all([loadMembers(), loadInvitations()]);
    setLoading(false);
  }

  async function loadMembers() {
    try {
      const res = await fetch('/api/team/members');
      if (!res.ok) throw new Error('Failed to load members');
      const data = await res.json();
      setMembers(data.members || []);
    } catch (err) {
      console.error('Failed to load members:', err);
    }
  }

  async function loadInvitations() {
    try {
      const res = await fetch('/api/team/invitations');
      console.log('[MembersTab] Invitations response status:', res.status);

      if (!res.ok) {
        const errorData = await res.json();
        console.error('[MembersTab] Invitations fetch failed:', res.status, errorData);
        throw new Error(`Failed to load invitations: ${errorData.error || res.statusText}`);
      }

      const data = await res.json();
      console.log('[MembersTab] Invitations data:', data);
      setInvitations(data.invitations || []);
    } catch (err) {
      console.error('[MembersTab] Failed to load invitations:', err);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError('');
    setInviteSuccess('');

    if (!inviteEmail.trim()) {
      setInviteError('Email is required');
      return;
    }

    setInviting(true);

    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send invitation');
      }

      setInviteSuccess(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
      setInviteRole('org:member');
      await loadInvitations();
    } catch (err: any) {
      setInviteError(err.message);
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(userId: string, newRole: 'org:admin' | 'org:member') {
    try {
      const res = await fetch(`/api/team/members/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Failed to update role');
        return;
      }

      await loadMembers();
    } catch (err: any) {
      alert(err.message || 'Failed to update role');
    }
  }

  async function handleRemoveMember(userId: string) {
    try {
      const res = await fetch(`/api/team/members/${userId}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Failed to remove member');
        return;
      }

      setConfirmingRemove(null);
      await loadMembers();
    } catch (err: any) {
      alert(err.message || 'Failed to remove member');
    }
  }

  async function handleRevokeInvitation(invitationId: string) {
    try {
      const res = await fetch(`/api/team/invitations/${invitationId}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Failed to revoke invitation');
        return;
      }

      await loadInvitations();
    } catch (err: any) {
      alert(err.message || 'Failed to revoke invitation');
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div style={{ padding: 24, color: C.text3, fontSize: 13 }}>
        Loading team...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 920 }}>
      {/* Section 1: Current Members */}
      <div style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 4 }}>
          Current members
        </h2>
        <p style={{ fontSize: 13, color: C.text3, marginBottom: 20 }}>
          {members.length} {members.length === 1 ? 'member' : 'members'}
        </p>

        <div style={{ background: C.surface, border: `1px solid ${C.border2}` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: C.text3, fontFamily: F.sans }}>
                  Name
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: C.text3, fontFamily: F.sans }}>
                  Email
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: C.text3, fontFamily: F.sans }}>
                  Role
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: C.text3, fontFamily: F.sans }}>
                  Joined
                </th>
                {isAdmin && (
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: C.text3, fontFamily: F.sans }}>
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const isCurrentUser = member.userId === user?.id;
                const isLastAdmin = members.filter(m => m.role === 'org:admin').length === 1 && member.role === 'org:admin';

                return (
                  <tr key={member.userId} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: 13, color: C.text, fontWeight: 500, fontFamily: F.sans }}>
                        {member.firstName || member.lastName ? `${member.firstName} ${member.lastName}`.trim() : '—'}
                        {isCurrentUser && (
                          <span style={{ fontSize: 11, color: C.text3, marginLeft: 6 }}>(you)</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: 13, color: C.text2, fontFamily: F.sans }}>{member.email}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {isAdmin && !isCurrentUser && !isLastAdmin ? (
                        <select
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.userId, e.target.value as 'org:admin' | 'org:member')}
                          style={{
                            padding: '6px 10px',
                            background: C.bg,
                            border: `1px solid ${C.border2}`,
                            color: C.text,
                            fontFamily: F.sans,
                            fontSize: 12,
                            cursor: 'pointer',
                          }}
                        >
                          <option value="org:admin">Admin</option>
                          <option value="org:member">Member</option>
                        </select>
                      ) : (
                        <span style={{ fontSize: 13, color: C.text2, fontFamily: F.sans }}>
                          {member.role === 'org:admin' ? 'Admin' : 'Member'}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: 13, color: C.text3, fontFamily: F.sans }}>
                        {formatDate(member.joinedAt)}
                      </div>
                    </td>
                    {isAdmin && (
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        {confirmingRemove === member.userId ? (
                          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', alignItems: 'center' }}>
                            <span style={{ fontSize: 12, color: C.text3, fontFamily: F.sans }}>
                              Remove {member.firstName || member.email}?
                            </span>
                            <button
                              onClick={() => handleRemoveMember(member.userId)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: C.red,
                                fontSize: 12,
                                fontFamily: F.sans,
                                cursor: 'pointer',
                                textDecoration: 'underline',
                              }}
                            >
                              Yes, remove
                            </button>
                            <button
                              onClick={() => setConfirmingRemove(null)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: C.text3,
                                fontSize: 12,
                                fontFamily: F.sans,
                                cursor: 'pointer',
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmingRemove(member.userId)}
                            disabled={isCurrentUser || isLastAdmin}
                            title={isCurrentUser ? 'Cannot remove yourself' : isLastAdmin ? 'Cannot remove last admin' : ''}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: isCurrentUser || isLastAdmin ? C.text3 : C.red,
                              fontSize: 12,
                              fontFamily: F.sans,
                              cursor: isCurrentUser || isLastAdmin ? 'not-allowed' : 'pointer',
                              opacity: isCurrentUser || isLastAdmin ? 0.4 : 1,
                            }}
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Pending Invitations */}
      {isAdmin && invitations.length > 0 && (
        <div style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 4 }}>
            Pending invitations
          </h2>
          <p style={{ fontSize: 13, color: C.text3, marginBottom: 20 }}>
            {invitations.length} pending {invitations.length === 1 ? 'invitation' : 'invitations'}
          </p>

          <div style={{ background: C.surface, border: `1px solid ${C.border2}` }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: C.text3, fontFamily: F.sans }}>
                    Email
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: C.text3, fontFamily: F.sans }}>
                    Role
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: C.text3, fontFamily: F.sans }}>
                    Invited
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: C.text3, fontFamily: F.sans }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((invitation) => (
                  <tr key={invitation.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: 13, color: C.text, fontFamily: F.sans }}>
                        {invitation.emailAddress}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: 13, color: C.text2, fontFamily: F.sans }}>
                        {invitation.role === 'org:admin' ? 'Admin' : 'Member'}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: 13, color: C.text3, fontFamily: F.sans }}>
                        {formatDate(invitation.createdAt)}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button
                        onClick={() => handleRevokeInvitation(invitation.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: C.red,
                          fontSize: 12,
                          fontFamily: F.sans,
                          cursor: 'pointer',
                        }}
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Section 3: Invite New Member */}
      {isAdmin && (
        <div style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 20 }}>
            Invite new member
          </h2>

          <form onSubmit={handleInvite}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 12, color: C.text3, marginBottom: 6, fontFamily: F.sans }}>
                  Email address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  disabled={inviting}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: C.surface,
                    border: `1px solid ${C.border2}`,
                    color: C.text,
                    fontFamily: F.sans,
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ width: 140 }}>
                <label style={{ display: 'block', fontSize: 12, color: C.text3, marginBottom: 6, fontFamily: F.sans }}>
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'org:admin' | 'org:member')}
                  disabled={inviting}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: C.surface,
                    border: `1px solid ${C.border2}`,
                    color: C.text,
                    fontFamily: F.sans,
                    fontSize: 14,
                    cursor: 'pointer',
                  }}
                >
                  <option value="org:member">Member</option>
                  <option value="org:admin">Admin</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={inviting || !inviteEmail.trim()}
                style={{
                  padding: '10px 24px',
                  background: C.indigo,
                  border: 'none',
                  color: C.text,
                  fontFamily: F.sans,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: inviting || !inviteEmail.trim() ? 'not-allowed' : 'pointer',
                  opacity: inviting || !inviteEmail.trim() ? 0.5 : 1,
                }}
              >
                {inviting ? 'Sending...' : 'Send invite'}
              </button>
            </div>

            {inviteSuccess && (
              <div style={{ marginTop: 12, fontSize: 13, color: C.green, fontFamily: F.sans }}>
                {inviteSuccess}
              </div>
            )}

            {inviteError && (
              <div style={{ marginTop: 12, fontSize: 13, color: C.red, fontFamily: F.sans }}>
                {inviteError}
              </div>
            )}
          </form>
        </div>
      )}

      {/* Section 4: Seats / Plan Info */}
      <div style={{ padding: 16, background: C.surface, border: `1px solid ${C.border2}` }}>
        <p style={{ fontSize: 13, color: C.text3, fontFamily: F.sans }}>
          Your plan supports unlimited team members.
        </p>
      </div>
    </div>
  );
}
