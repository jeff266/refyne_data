'use client';

import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import { C, F } from '@/lib/design-tokens';

export default function TermsPage() {
  const sections = [
    { id: 'acceptance', title: 'Acceptance of terms' },
    { id: 'service', title: 'Service description' },
    { id: 'registration', title: 'Account registration' },
    { id: 'acceptable-use', title: 'Acceptable use' },
    { id: 'data-ownership', title: 'Data ownership' },
    { id: 'payment', title: 'Payment terms' },
    { id: 'cancellation', title: 'Cancellation' },
    { id: 'liability', title: 'Limitation of liability' },
    { id: 'governing-law', title: 'Governing law' },
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
            Terms of Service
          </h1>

          <div style={{ fontSize: 13, color: C.text3, marginBottom: 48 }}>
            <div>Effective date: January 1, 2026</div>
            <div>Last updated: May 18, 2026</div>
          </div>

          <Section id="acceptance" title="Acceptance of terms">
            <Placeholder>
              This section states that by accessing or using Refyne, you agree to be bound by these
              Terms of Service and all applicable laws and regulations.
            </Placeholder>
          </Section>

          <Section id="service" title="Service description">
            <Placeholder>
              This section describes Refyne as a HubSpot data quality platform that provides
              normalization, deduplication, compliance monitoring, and automated data harmonization.
            </Placeholder>
          </Section>

          <Section id="registration" title="Account registration">
            <Placeholder>
              This section describes requirements for creating an account, including providing
              accurate information, maintaining account security, and restrictions on account sharing.
            </Placeholder>
          </Section>

          <Section id="acceptable-use" title="Acceptable use">
            <Placeholder>
              This section outlines prohibited uses of Refyne, including unauthorized access,
              transmission of malicious code, data scraping, and activities that violate laws or
              third-party rights.
            </Placeholder>
          </Section>

          <Section id="data-ownership" title="Data ownership">
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6 }}>
              <strong>You retain ownership of all data synced from HubSpot.</strong>
            </p>
            <Placeholder>
              This section clarifies that customers retain full ownership of their HubSpot data,
              Refyne acts as a data processor, and details around data portability and export rights.
            </Placeholder>
          </Section>

          <Section id="payment" title="Payment terms">
            <Placeholder>
              This section describes subscription billing, payment methods, automatic renewal,
              price changes, and refund policies.
            </Placeholder>
          </Section>

          <Section id="cancellation" title="Cancellation">
            <Placeholder>
              This section explains how to cancel your subscription, what happens to your data
              after cancellation, and any data retention or deletion timelines.
            </Placeholder>
          </Section>

          <Section id="liability" title="Limitation of liability">
            <Placeholder>
              This section limits Refyne's liability for indirect damages, data loss, or service
              interruptions, and establishes maximum liability amounts.
            </Placeholder>
          </Section>

          <Section id="governing-law" title="Governing law">
            <Placeholder>
              This section specifies the jurisdiction and governing law for disputes, arbitration
              requirements, and venue for legal proceedings.
            </Placeholder>
          </Section>

          <Section id="contact" title="Contact">
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6 }}>
              For questions about these Terms of Service, contact us at{' '}
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
