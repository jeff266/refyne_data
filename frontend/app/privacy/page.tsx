'use client';

import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import { C, F } from '@/lib/design-tokens';

export default function PrivacyPage() {
  const sections = [
    { id: 'collection', title: 'What data we collect' },
    { id: 'usage', title: 'How we use your data' },
    { id: 'hubspot', title: 'Data from HubSpot' },
    { id: 'retention', title: 'Data retention' },
    { id: 'deletion', title: 'Data deletion' },
    { id: 'cookies', title: 'Cookies' },
    { id: 'third-party', title: 'Third-party services' },
    { id: 'contact', title: 'Contact' },
  ];

  return (
    <MarketingLayout>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '64px 32px', display: 'flex', gap: 64 }}>
        {/* Sticky TOC - Desktop only */}
        <aside style={{ width: 200, flexShrink: 0, position: 'sticky', top: 32, height: 'fit-content', display: 'none' }}>
          <nav style={{ fontSize: 13 }}>
            <div style={{ fontWeight: 600, color: C.text, marginBottom: 12 }}>On this page</div>
            {sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                style={{
                  display: 'block',
                  padding: '6px 0',
                  color: C.text2,
                  textDecoration: 'none',
                  transition: 'color 0.2s',
                }}
              >
                {section.title}
              </a>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <article style={{ flex: 1, maxWidth: 720 }}>
          <h1 style={{ fontSize: 36, fontWeight: 600, color: C.text, marginBottom: 12 }}>
            Privacy Policy
          </h1>

          <div style={{ fontSize: 13, color: C.text3, marginBottom: 48 }}>
            <div>Effective date: January 1, 2026</div>
            <div>Last updated: May 18, 2026</div>
          </div>

          <Section id="collection" title="What data we collect">
            <Placeholder>
              This section describes the types of data Refyne collects when you use our service,
              including account information, usage data, and CRM data synced from HubSpot.
            </Placeholder>
          </Section>

          <Section id="usage" title="How we use your data">
            <Placeholder>
              This section explains how Refyne uses collected data to provide services, improve
              product functionality, and communicate with users.
            </Placeholder>
          </Section>

          <Section id="hubspot" title="Data from HubSpot">
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, marginBottom: 16 }}>
              Refyne requests the following OAuth scopes from HubSpot:
            </p>
            <ul style={{ fontSize: 14, color: C.text2, lineHeight: 1.8, marginLeft: 20 }}>
              <li>
                <strong>crm.objects.companies.read</strong> — Read company records for compliance scanning and dedup detection
              </li>
              <li>
                <strong>crm.objects.companies.write</strong> — Write normalized field values back to HubSpot
              </li>
              <li>
                <strong>crm.export</strong> — Export full portal data for comprehensive compliance scans
              </li>
              <li>
                <strong>oauth</strong> — Authenticate and maintain your connection
              </li>
            </ul>
            <Placeholder>
              Additional details about how HubSpot data is processed, stored, and protected.
            </Placeholder>
          </Section>

          <Section id="retention" title="Data retention">
            <Placeholder>
              This section describes how long Refyne retains user data, compliance scan results,
              and HubSpot sync data.
            </Placeholder>
          </Section>

          <Section id="deletion" title="Data deletion">
            <Placeholder>
              This section explains how users can request deletion of their data and what happens
              when a workspace is deleted.
            </Placeholder>
          </Section>

          <Section id="cookies" title="Cookies">
            <Placeholder>
              This section describes Refyne's use of cookies for authentication, session management,
              and analytics.
            </Placeholder>
          </Section>

          <Section id="third-party" title="Third-party services">
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, marginBottom: 16 }}>
              Refyne uses the following third-party services:
            </p>
            <ul style={{ fontSize: 14, color: C.text2, lineHeight: 1.8, marginLeft: 20 }}>
              <li><strong>Supabase</strong> — Database and authentication</li>
              <li><strong>Vercel</strong> — Application hosting</li>
              <li><strong>Railway</strong> — Background job processing</li>
              <li><strong>Resend</strong> — Transactional email delivery</li>
              <li><strong>Stripe</strong> — Payment processing</li>
              <li><strong>Upstash</strong> — Redis for job queues</li>
              <li><strong>Clerk</strong> — User authentication and organization management</li>
            </ul>
            <Placeholder>
              Additional details about data sharing, processing agreements, and security measures.
            </Placeholder>
          </Section>

          <Section id="contact" title="Contact">
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6 }}>
              For questions about this Privacy Policy, contact us at{' '}
              <a href="mailto:jeff@revopsimpact.us" style={{ color: C.indigo, textDecoration: 'none' }}>
                jeff@revopsimpact.us
              </a>
            </p>
          </Section>
        </article>
      </div>
    </MarketingLayout>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ marginBottom: 48 }}>
      <h2 style={{ fontSize: 24, fontWeight: 600, color: C.text, marginBottom: 16 }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 16,
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        fontSize: 13,
        color: C.text3,
        fontStyle: 'italic',
      }}
    >
      [Placeholder] {children}
    </div>
  );
}
