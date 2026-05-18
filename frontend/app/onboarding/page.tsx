'use client';

import { useEffect, useState } from 'react';
import { useOrganization, useOrganizationList, useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { C, F } from '@/lib/design-tokens';
import { PrimaryBtn } from '@/components/refyne/PrimaryBtn';
import { GhostBtn } from '@/components/refyne/GhostBtn';

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useUser();
  const { organization } = useOrganization();
  const { createOrganization, setActive, userMemberships } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  const [workspaceName, setWorkspaceName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirect to dashboard if user already has an active organization
  useEffect(() => {
    if (organization) {
      router.push('/dashboard');
    }
  }, [organization, router]);

  const handleCreateWorkspace = async () => {
    if (!workspaceName.trim()) {
      setError('Workspace name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const org = await createOrganization({ name: workspaceName });

      if (!org) {
        throw new Error('Failed to create organization');
      }

      // Create workspace_entitlements row in Supabase
      const res = await fetch('/api/org/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clerk_org_id: org.id,
          org_name: workspaceName,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to create workspace settings');
      }

      // Set as active organization
      await setActive({ organization: org.id });

      // Redirect to connections to set up HubSpot
      router.push('/connections');
    } catch (err: any) {
      setError(err.message || 'Failed to create workspace');
      setLoading(false);
    }
  };

  const handleSelectOrganization = async (orgId: string) => {
    setLoading(true);
    try {
      await setActive({ organization: orgId });
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to join organization');
      setLoading(false);
    }
  };

  const existingOrgs = userMemberships?.data || [];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: C.bg,
        fontFamily: F.sans,
        padding: 24,
      }}
    >
      <div
        style={{
          background: C.sidebar,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          padding: 48,
          maxWidth: 480,
          width: '100%',
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8, color: C.text1 }}>
          Welcome to Refyne
        </h1>
        <p style={{ fontSize: 14, color: C.text2, marginBottom: 32 }}>
          Get started by creating or joining a workspace
        </p>

        {existingOrgs.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 500, marginBottom: 16, color: C.text1 }}>
              Join existing workspace
            </h2>
            {existingOrgs.map((membership) => (
              <div
                key={membership.organization.id}
                style={{
                  padding: 16,
                  background: C.hover,
                  border: `1px solid ${C.border}`,
                  borderRadius: 4,
                  marginBottom: 8,
                  cursor: 'pointer',
                }}
                onClick={() => handleSelectOrganization(membership.organization.id)}
              >
                <div style={{ fontSize: 14, color: C.text1, fontWeight: 500 }}>
                  {membership.organization.name}
                </div>
                <div style={{ fontSize: 12, color: C.text3 }}>
                  {membership.role}
                </div>
              </div>
            ))}
          </div>
        )}

        <div>
          <h2 style={{ fontSize: 16, fontWeight: 500, marginBottom: 16, color: C.text1 }}>
            Create new workspace
          </h2>

          <input
            type="text"
            placeholder="Workspace name (e.g., Acme Corp)"
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: C.bg,
              border: `1px solid ${C.border}`,
              borderRadius: 4,
              fontSize: 14,
              color: C.text1,
              marginBottom: 16,
              fontFamily: F.sans,
            }}
          />

          {error && (
            <p style={{ fontSize: 13, color: C.red, marginBottom: 16 }}>
              {error}
            </p>
          )}

          <PrimaryBtn
            onClick={handleCreateWorkspace}
            disabled={loading || !workspaceName.trim()}
          >
            {loading ? 'Creating...' : 'Create Workspace'}
          </PrimaryBtn>
        </div>

        <div style={{ marginTop: 24, paddingTop: 24, borderTop: `1px solid ${C.border}` }}>
          <p style={{ fontSize: 13, color: C.text3 }}>
            Signed in as {user?.primaryEmailAddress?.emailAddress}
          </p>
        </div>
      </div>
    </div>
  );
}
