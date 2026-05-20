'use client';

import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import { C, F } from '@/lib/design-tokens';

export default function SecurityPage() {
  const sections = [
    { id: 'data-security', title: 'Data Security' },
    { id: 'infrastructure', title: 'Infrastructure' },
    { id: 'crm-data', title: 'How We Handle Your CRM Data' },
    { id: 'ai-features', title: 'AI Features' },
    { id: 'data-retention', title: 'Data Retention' },
    { id: 'compliance', title: 'Compliance' },
    { id: 'vulnerability', title: 'Vulnerability Disclosure' },
    { id: 'contact', title: 'Contact' },
  ];

  return (
    <MarketingLayout>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '64px 32px', display: 'flex', gap: 64 }}>
        {/* Sticky TOC - Desktop only */}
        <aside style={{ width: 200, flexShrink: 0, position: 'sticky', top: 32, height: 'fit-content' }}>
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
          <h1 style={{ fontSize: 36, fontWeight: 600, color: C.text, marginBottom: 48 }}>
            Security at Refyne
          </h1>

          <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, marginBottom: 48 }}>
            Refyne is a B2B CRM data quality platform. We connect to your HubSpot instance, read your company and contact records,
            and help you detect duplicates, normalize fields, and enrich data. This page explains how we protect your data and what we do with it.
          </p>

          <Section id="data-security" title="Data Security">
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, marginBottom: 16 }}>
              <strong>Encryption</strong><br />
              All data transmitted between Refyne and your browser is encrypted using TLS 1.2 or higher. All data stored in our database
              is encrypted at rest using AES-256. HubSpot access tokens are stored in encrypted form and never logged or exposed in responses.
            </p>
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, marginBottom: 16 }}>
              <strong>Access Controls</strong><br />
              Refyne uses role-based access control with three permission levels: Admin, Operator, and Viewer. Every database query is
              scoped to your organization — your data is never accessible to other Refyne customers. Authentication is handled by Clerk,
              which supports multi-factor authentication.
            </p>
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6 }}>
              <strong>Network Security</strong><br />
              API endpoints are rate-limited per organization to prevent abuse. All infrastructure runs behind HTTPS with automated
              certificate renewal. Our worker processes run in isolated containers.
            </p>
          </Section>

          <Section id="infrastructure" title="Infrastructure">
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, marginBottom: 16 }}>
              Refyne is built on the following infrastructure providers:
            </p>
            <table style={{ width: '100%', fontSize: 14, color: C.text2, borderCollapse: 'collapse', marginBottom: 16 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 600 }}>Component</th>
                  <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 600 }}>Provider</th>
                  <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 600 }}>Region</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '12px 8px' }}>Application hosting</td>
                  <td style={{ padding: '12px 8px' }}>Vercel</td>
                  <td style={{ padding: '12px 8px' }}>Global edge</td>
                </tr>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '12px 8px' }}>Database</td>
                  <td style={{ padding: '12px 8px' }}>Supabase</td>
                  <td style={{ padding: '12px 8px' }}>US East</td>
                </tr>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '12px 8px' }}>Authentication</td>
                  <td style={{ padding: '12px 8px' }}>Clerk</td>
                  <td style={{ padding: '12px 8px' }}>US</td>
                </tr>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '12px 8px' }}>Background workers</td>
                  <td style={{ padding: '12px 8px' }}>Hostinger VPS + Railway</td>
                  <td style={{ padding: '12px 8px' }}>US</td>
                </tr>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '12px 8px' }}>Cache and queues</td>
                  <td style={{ padding: '12px 8px' }}>Upstash</td>
                  <td style={{ padding: '12px 8px' }}>US</td>
                </tr>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '12px 8px' }}>Payments</td>
                  <td style={{ padding: '12px 8px' }}>Stripe</td>
                  <td style={{ padding: '12px 8px' }}>US</td>
                </tr>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '12px 8px' }}>Transactional email</td>
                  <td style={{ padding: '12px 8px' }}>Resend</td>
                  <td style={{ padding: '12px 8px' }}>US</td>
                </tr>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '12px 8px' }}>AI features</td>
                  <td style={{ padding: '12px 8px' }}>Anthropic</td>
                  <td style={{ padding: '12px 8px' }}>US</td>
                </tr>
                <tr>
                  <td style={{ padding: '12px 8px' }}>Error monitoring</td>
                  <td style={{ padding: '12px 8px' }}>Sentry</td>
                  <td style={{ padding: '12px 8px' }}>US</td>
                </tr>
              </tbody>
            </table>
          </Section>

          <Section id="crm-data" title="How We Handle Your CRM Data">
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, marginBottom: 16 }}>
              <strong>What we read</strong><br />
              Refyne reads company and contact records from your HubSpot instance via the HubSpot API. This includes fields such as
              company name, domain, phone number, industry, and contact details used to detect duplicates and apply normalization rules.
            </p>
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, marginBottom: 16 }}>
              <strong>What we store</strong><br />
              Refyne stores blocking key indexes (normalized domain, phone prefix, name prefix) to power incremental duplicate scanning.
              We store normalization run history, duplicate pair records, and compliance scores. We do not store complete copies of your
              HubSpot records.
            </p>
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, marginBottom: 16 }}>
              <strong>What we write</strong><br />
              Refyne writes to HubSpot only when you explicitly approve a change. Normalization runs, dedup merges, and enrichment pushes
              require user action before any data is written back to HubSpot. Nothing is written automatically without approval.
            </p>
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6 }}>
              <strong>What we do not do</strong><br />
              We do not sell your data. We do not share your CRM data with third parties outside of the sub-processors listed above.
              We do not use your data to train machine learning models.
            </p>
          </Section>

          <Section id="ai-features" title="AI Features">
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, marginBottom: 16 }}>
              Refyne uses Claude by Anthropic to generate compliance summaries, quarantine triage analysis, and enrichment rehearsal
              recommendations. When AI features are active, relevant compliance metrics and record-level data are sent to the Anthropic
              API to generate these summaries.
            </p>
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, marginBottom: 16 }}>
              Anthropic does not train its models on data submitted via the API. AI-generated summaries are cached in Refyne's
              infrastructure and are not retained by Anthropic beyond the API request.
            </p>
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6 }}>
              AI features can be disabled by not adding an Anthropic API key to your workspace configuration.
            </p>
          </Section>

          <Section id="data-retention" title="Data Retention">
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, marginBottom: 16 }}>
              Active workspaces retain CRM indexes, compliance history, and dedup records for as long as the account is active.
              When a workspace is deleted, all associated data is removed from Refyne's systems within 30 days. Stripe retains
              billing records per their own retention policy.
            </p>
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6 }}>
              You can request deletion of your workspace and all associated data at any time by contacting support.
            </p>
          </Section>

          <Section id="compliance" title="Compliance">
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, marginBottom: 16 }}>
              <strong>GDPR</strong><br />
              Refyne processes data on behalf of its customers as a data processor. If you are subject to GDPR and require a Data
              Processing Agreement, contact us at security@refynedata.com.
            </p>
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, marginBottom: 16 }}>
              <strong>HIPAA</strong><br />
              Refyne is not a HIPAA-covered entity and is not designed for the storage or processing of Protected Health Information.
              Refyne should not be used to process PHI.
            </p>
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, marginBottom: 16 }}>
              <strong>HubSpot Marketplace</strong><br />
              Refyne is a registered HubSpot application. Our integration complies with HubSpot's developer terms and data handling policies.
            </p>
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6 }}>
              <strong>SOC 2</strong><br />
              Refyne does not currently hold a SOC 2 certification. We are building toward SOC 2 Type II compliance. If you have
              specific security requirements, contact us to discuss.
            </p>
          </Section>

          <Section id="vulnerability" title="Vulnerability Disclosure">
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6 }}>
              If you discover a security vulnerability in Refyne, please report it to security@refynedata.com. We will acknowledge
              receipt within 48 hours and provide a resolution timeline. We ask that you do not publicly disclose vulnerabilities
              until we have had the opportunity to address them.
            </p>
          </Section>

          <Section id="contact" title="Contact">
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, marginBottom: 8 }}>
              For security questions, data requests, or DPA inquiries:
            </p>
            <div style={{ fontSize: 14, color: C.text2, lineHeight: 1.8 }}>
              <a href="mailto:security@refynedata.com" style={{ color: C.indigo, textDecoration: 'none' }}>
                security@refynedata.com
              </a>
            </div>
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
