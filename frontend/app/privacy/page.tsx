'use client';

import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import { C, F } from '@/lib/design-tokens';

export default function PrivacyPage() {
  const sections = [
    { id: 'collection', title: 'What data we collect' },
    { id: 'usage', title: 'How we use your data' },
    { id: 'hubspot', title: 'Data accessed from HubSpot' },
    { id: 'storage', title: 'How we store and protect your data' },
    { id: 'retention', title: 'Data retention' },
    { id: 'deletion', title: 'Data deletion' },
    { id: 'cookies', title: 'Cookies' },
    { id: 'third-party', title: 'Third-party services' },
    { id: 'ccpa', title: 'California residents (CCPA)' },
    { id: 'changes', title: 'Changes to this policy' },
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
          <h1 style={{ fontSize: 36, fontWeight: 600, color: C.text, marginBottom: 12 }}>
            Privacy Policy
          </h1>

          <div style={{ fontSize: 13, color: C.text3, marginBottom: 16 }}>
            <div>Effective date: May 18, 2026</div>
            <div>Last updated: May 18, 2026</div>
          </div>

          <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, marginBottom: 48 }}>
            Refyne is a product of RevOps Impact LLC ("we," "us," or "our"), a company based in Los Angeles, California.
            This Privacy Policy explains how we collect, use, and protect information when you use Refyne at app.refynedata.com.
          </p>

          <Section id="collection" title="What data we collect">
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, marginBottom: 16 }}>
              <strong>Account information.</strong> When you create a Refyne account, we collect your name, email address,
              and password (managed by Clerk, our authentication provider). If you sign in via a third-party provider,
              we receive basic profile information from that provider.
            </p>
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, marginBottom: 16 }}>
              <strong>Workspace information.</strong> When you create or join a workspace, we store your organization name,
              your role within the organization, and your workspace settings and preferences.
            </p>
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, marginBottom: 16 }}>
              <strong>HubSpot CRM data.</strong> When you connect a HubSpot portal to Refyne, we access company records
              from your HubSpot account using the permissions you grant via OAuth. Specifically, we access and process
              company names, domains, phone numbers, industry classifications, employee counts, addresses, and LinkedIn URLs.
              We do not access contact records, deal records, or any personally identifiable information about your customers
              unless those fields appear in your company records.
            </p>
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, marginBottom: 16 }}>
              <strong>Usage data.</strong> We collect information about how you use Refyne, including pages visited,
              features used, actions taken, and timestamps. We use this to improve the product and provide support.
            </p>
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, marginBottom: 16 }}>
              <strong>Payment information.</strong> Billing is processed by Stripe. We do not store your credit card
              number or payment details. We store your subscription plan, billing status, and transaction history.
            </p>
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6 }}>
              <strong>Communications.</strong> If you contact us for support, we retain those communications.
            </p>
          </Section>

          <Section id="usage" title="How we use your data">
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, marginBottom: 16 }}>
              We use the data we collect to:
            </p>
            <ul style={{ fontSize: 14, color: C.text2, lineHeight: 1.8, marginLeft: 20, marginBottom: 16 }}>
              <li>Provide the Refyne service, including data normalization, deduplication, compliance scoring, and enrichment features</li>
              <li>Connect to and exchange data with your HubSpot portal on your behalf</li>
              <li>Send you product notifications, digest emails, and compliance alerts that you have opted into</li>
              <li>Process payments and manage your subscription</li>
              <li>Respond to support requests</li>
              <li>Improve and develop the Refyne product</li>
              <li>Detect and prevent fraud, abuse, or security incidents</li>
            </ul>
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6 }}>
              We do not sell your data to third parties. We do not use your HubSpot CRM data for advertising purposes.
            </p>
          </Section>

          <Section id="hubspot" title="Data accessed from HubSpot">
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, marginBottom: 16 }}>
              When you connect a HubSpot portal, Refyne requests the following OAuth permissions:
            </p>
            <table style={{ width: '100%', fontSize: 14, color: C.text2, borderCollapse: 'collapse', marginBottom: 16 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 600 }}>Scope</th>
                  <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 600 }}>Why we need it</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '12px 8px', fontFamily: F.mono, fontSize: 13 }}>crm.objects.companies.read</td>
                  <td style={{ padding: '12px 8px' }}>To read company records for compliance scanning and deduplication</td>
                </tr>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '12px 8px', fontFamily: F.mono, fontSize: 13 }}>crm.objects.companies.write</td>
                  <td style={{ padding: '12px 8px' }}>To write normalized values back to your HubSpot company records</td>
                </tr>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '12px 8px', fontFamily: F.mono, fontSize: 13 }}>crm.export</td>
                  <td style={{ padding: '12px 8px' }}>To export your full portal for compliance scanning</td>
                </tr>
                <tr>
                  <td style={{ padding: '12px 8px', fontFamily: F.mono, fontSize: 13 }}>oauth</td>
                  <td style={{ padding: '12px 8px' }}>To authenticate your HubSpot connection securely</td>
                </tr>
              </tbody>
            </table>
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6 }}>
              We only request permissions we actively use. Your HubSpot data is processed to provide the Refyne service
              and is not shared with third parties except as described in this policy.
            </p>
          </Section>

          <Section id="storage" title="How we store and protect your data">
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, marginBottom: 16 }}>
              Your data is stored in the United States using the following infrastructure:
            </p>
            <ul style={{ fontSize: 14, color: C.text2, lineHeight: 1.8, marginLeft: 20, marginBottom: 16 }}>
              <li><strong>Supabase</strong> — our primary database (PostgreSQL), hosted on AWS US East</li>
              <li><strong>Upstash</strong> — Redis-based queue for background job processing</li>
              <li><strong>Vercel</strong> — hosting for the Refyne web application</li>
            </ul>
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, marginBottom: 16 }}>
              We implement technical safeguards including encrypted connections (TLS), access controls, and role-based permissions.
              We review security practices regularly and apply updates promptly.
            </p>
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6 }}>
              Despite these measures, no system is completely secure. We encourage you to use a strong password and report
              any suspected security issues to jeff@revopsimpact.us immediately.
            </p>
          </Section>

          <Section id="retention" title="Data retention">
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, marginBottom: 16 }}>
              We retain your account data for as long as your account is active. We retain your workspace data, compliance history,
              and deduplication records for as long as your subscription is active plus 90 days after cancellation, to allow for data export.
            </p>
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, marginBottom: 16 }}>
              When you delete your account or workspace, we delete your data within 30 days, except where we are required
              to retain it by law (for example, billing records).
            </p>
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6 }}>
              HubSpot CRM data processed by Refyne is stored only as derived outputs (compliance scores, deduplication pairs,
              normalized values). We do not retain raw exports of your HubSpot data beyond the time needed to complete a scan.
            </p>
          </Section>

          <Section id="deletion" title="Data deletion">
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, marginBottom: 16 }}>
              You may request deletion of your account and associated data at any time by contacting us at jeff@revopsimpact.us.
              We will process deletion requests within 30 days.
            </p>
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6 }}>
              Workspace admins may delete a workspace from the Settings → Danger Zone section of the Refyne application.
            </p>
          </Section>

          <Section id="cookies" title="Cookies">
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6 }}>
              Refyne uses session cookies to keep you signed in. These are set by Clerk, our authentication provider,
              and are essential to the operation of the service. We do not use advertising cookies or third-party tracking cookies.
            </p>
          </Section>

          <Section id="third-party" title="Third-party services">
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, marginBottom: 16 }}>
              Refyne uses the following third-party services to operate:
            </p>
            <table style={{ width: '100%', fontSize: 14, color: C.text2, borderCollapse: 'collapse', marginBottom: 16 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 600 }}>Service</th>
                  <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 600 }}>Purpose</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '12px 8px' }}>Clerk</td>
                  <td style={{ padding: '12px 8px' }}>Authentication and user management</td>
                </tr>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '12px 8px' }}>Supabase</td>
                  <td style={{ padding: '12px 8px' }}>Database and storage</td>
                </tr>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '12px 8px' }}>Vercel</td>
                  <td style={{ padding: '12px 8px' }}>Web application hosting</td>
                </tr>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '12px 8px' }}>Railway</td>
                  <td style={{ padding: '12px 8px' }}>Background job infrastructure</td>
                </tr>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '12px 8px' }}>Resend</td>
                  <td style={{ padding: '12px 8px' }}>Transactional email delivery</td>
                </tr>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '12px 8px' }}>Stripe</td>
                  <td style={{ padding: '12px 8px' }}>Payment processing</td>
                </tr>
                <tr>
                  <td style={{ padding: '12px 8px' }}>Upstash</td>
                  <td style={{ padding: '12px 8px' }}>Job queue (Redis)</td>
                </tr>
              </tbody>
            </table>
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6 }}>
              Each of these services has its own privacy policy and data processing terms. We select providers
              that maintain appropriate data protection standards.
            </p>
          </Section>

          <Section id="ccpa" title="California residents (CCPA)">
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, marginBottom: 16 }}>
              If you are a California resident, you have the right to:
            </p>
            <ul style={{ fontSize: 14, color: C.text2, lineHeight: 1.8, marginLeft: 20, marginBottom: 16 }}>
              <li>Know what personal information we collect and how we use it</li>
              <li>Request deletion of your personal information</li>
              <li>Opt out of the sale of your personal information (we do not sell personal information)</li>
              <li>Non-discrimination for exercising your privacy rights</li>
            </ul>
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6 }}>
              To exercise these rights, contact us at jeff@revopsimpact.us. We will respond within 45 days.
            </p>
          </Section>

          <Section id="changes" title="Changes to this policy">
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6 }}>
              We may update this Privacy Policy from time to time. We will notify you of material changes by email
              or by posting a notice in the Refyne application. The "Last updated" date at the top of this page
              reflects when changes were last made.
            </p>
          </Section>

          <Section id="contact" title="Contact">
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, marginBottom: 8 }}>
              If you have questions about this Privacy Policy or our data practices, contact us:
            </p>
            <div style={{ fontSize: 14, color: C.text2, lineHeight: 1.8 }}>
              <strong>RevOps Impact LLC</strong><br />
              Los Angeles, California<br />
              <a href="mailto:jeff@revopsimpact.us" style={{ color: C.indigo, textDecoration: 'none' }}>
                jeff@revopsimpact.us
              </a><br />
              refynedata.com
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
