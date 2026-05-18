'use client';

import { useEffect, useState } from 'react';
import { C, F } from '@/lib/design-tokens';
import { Card, PrimaryBtn, GhostBtn } from '@/components/refyne';

interface Member {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  imageUrl: string;
  role: string;
  createdAt: number;
}

export function MembersTab() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('org:operator');
  const [error, setError] = useState('');

  useEffect(() => {
    loadMembers();
  }, []);

  async function loadMembers() {
    try {
      const res = await fetch('/api/org/members');
      if (!res.ok) throw new Error('Failed to load members');
      const data = await res.json();
      setMembers(data.members || []);
    } catch (err) {
      console.error('Failed to load members:', err);
      setError('Failed to load members');
    } finally {
      setLoading(false);
    }
  }

  async function handleInvite() {
    if (!inviteEmail) {
      setError('Email is required');
      return;
    }

    setError('');
    try {
      const res = await fetch('/api/org/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to invite member');
      }

      setInviteEmail('');
      setShowInvite(false);
      alert('Invitation sent!');
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleRemove(userId: string) {
    if (!confirm('Remove this member from the organization?')) return;

    try {
      const res = await fetch(`/api/org/members/${userId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to remove member');
      }

      await loadMembers();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    try {
      const res = await fetch(`/api/org/members/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to change role');
      }

      await loadMembers();
    } catch (err: any) {
      alert(err.message);
    }
  }

  if (loading) {
    return <div style={{ color: C.text3, fontSize: 13 }}>Loading members...</div>;
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 4 }}>Team Members</h2>
          <p style={{ fontSize: 13, color: C.text3 }}>{members.length} members</p>
        </div>
        <PrimaryBtn onClick={() => setShowInvite(true)}>Invite Member</PrimaryBtn>
      </div>

      {error && (
        <div style={{ padding: 12, background: C.red + '20', borderRadius: 6, marginBottom: 16 }}>
          <span style={{ fontSize: 13, color: C.red }}>{error}</span>
        </div>
      )}

      {/* Invite Form */}
      {showInvite && (
        <Card style={{ marginBottom: 16, padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 16 }}>Invite New Member</h3>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: C.text3, marginBottom: 6, display: 'block' }}>Email</label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="member@company.com"
              style={{
                width: '100%',
                padding: '8px 12px',
                background: C.surface,
                border: `1px solid ${C.border2}`,
                borderRadius: 6,
                color: C.text,
                fontFamily: F.sans,
                fontSize: 13,
              }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: C.text3, marginBottom: 6, display: 'block' }}>Role</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: C.surface,
                border: `1px solid ${C.border2}`,
                borderRadius: 6,
                color: C.text,
                fontFamily: F.sans,
                fontSize: 13,
              }}
            >
              <option value="org:viewer">Viewer</option>
              <option value="org:operator">Operator</option>
              <option value="org:admin">Admin</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <PrimaryBtn onClick={handleInvite}>Send Invitation</PrimaryBtn>
            <GhostBtn onClick={() => setShowInvite(false)}>Cancel</GhostBtn>
          </div>
        </Card>
      )}

      {/* Members Table */}
      <Card>
        <div style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: C.text3 }}>
                  Member
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: C.text3 }}>
                  Role
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: C.text3 }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.userId} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {member.imageUrl && (
                        <img
                          src={member.imageUrl}
                          alt=""
                          style={{ width: 32, height: 32, borderRadius: '50%' }}
                        />
                      )}
                      <div>
                        <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>
                          {member.firstName} {member.lastName}
                        </div>
                        <div style={{ fontSize: 12, color: C.text3 }}>{member.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.userId, e.target.value)}
                      style={{
                        padding: '6px 10px',
                        background: C.surface,
                        border: `1px solid ${C.border2}`,
                        borderRadius: 4,
                        color: C.text,
                        fontFamily: F.sans,
                        fontSize: 12,
                      }}
                    >
                      <option value="org:viewer">Viewer</option>
                      <option value="org:operator">Operator</option>
                      <option value="org:admin">Admin</option>
                    </select>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <GhostBtn onClick={() => handleRemove(member.userId)}>Remove</GhostBtn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
