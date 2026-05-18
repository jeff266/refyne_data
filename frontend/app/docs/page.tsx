import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import { C, F } from '@/lib/design-tokens';

export default function DocsPage() {
  return (
    <MarketingLayout>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '64px 32px' }}>
        <h1 style={{ fontSize: 36, fontWeight: 600, color: C.text, marginBottom: 12 }}>
          Connect Refyne to HubSpot
        </h1>
        <p style={{ fontSize: 16, color: C.text2, marginBottom: 48, lineHeight: 1.6 }}>
          Follow these steps to get started with Refyne and connect your HubSpot portal.
        </p>

        {/* Step 1 */}
        <Step number={1} title="Create a Refyne account">
          <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, marginBottom: 16 }}>
            Sign up at <strong>refyne.io</strong> using your work email. You'll be prompted to
            create your first workspace.
          </p>
          <Screenshot label="Sign up page" width={600} height={400} />
        </Step>

        {/* Step 2 */}
        <Step number={2} title="Connect your HubSpot portal">
          <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, marginBottom: 16 }}>
            Navigate to <strong>Connections</strong> and click <strong>"Connect HubSpot"</strong>.
            You'll be redirected to HubSpot to approve the OAuth connection.
          </p>
          <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, marginBottom: 16 }}>
            Refyne requests these scopes and why:
          </p>
          <ul style={{ fontSize: 14, color: C.text2, lineHeight: 1.8, marginLeft: 20, marginBottom: 16 }}>
            <li>
              <strong>crm.objects.companies.read</strong> — Read company records for scanning
            </li>
            <li>
              <strong>crm.objects.companies.write</strong> — Write normalized values back to HubSpot
            </li>
            <li>
              <strong>crm.export</strong> — Export full portal for compliance scans
            </li>
            <li>
              <strong>oauth</strong> — Authenticate your account
            </li>
          </ul>
          <Screenshot label="HubSpot OAuth approval screen" width={600} height={500} />
        </Step>

        {/* Step 3 */}
        <Step number={3} title="Configure Harmonies">
          <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, marginBottom: 16 }}>
            Go to <strong>Harmonies</strong> and enable the recommended set. Harmonies define data
            quality rules like phone number formatting, email validation, and state/country
            normalization.
          </p>
          <Screenshot label="Harmonies configuration page" width={600} height={400} />
        </Step>

        {/* Step 4 */}
        <Step number={4} title="Run your first compliance scan">
          <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, marginBottom: 16 }}>
            Navigate to <strong>Dashboard</strong> and click <strong>"Run scan"</strong>. This will
            analyze your HubSpot data against all active Harmonies and generate a compliance score.
          </p>
          <Screenshot label="Compliance dashboard with score" width={600} height={400} />
        </Step>

        {/* Step 5 */}
        <Step number={5} title="Review dedup queue">
          <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, marginBottom: 16 }}>
            Go to <strong>Dedup</strong> and filter for Grade A pairs. These are high-confidence
            duplicates ready for bulk approval. You can also use the accordion view for detailed
            record-by-record review.
          </p>
          <Screenshot label="Dedup queue with Grade A filter" width={600} height={450} />
        </Step>

        {/* Step 6 */}
        <Step number={6} title="Enable Always On (optional)">
          <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, marginBottom: 16 }}>
            In <strong>Settings → Always On</strong>, toggle on nightly monitoring. Add email
            recipients to receive daily compliance digests. Always On is a paid add-on.
          </p>
          <Screenshot label="Always On settings page" width={600} height={400} />
        </Step>

        {/* Support */}
        <div
          style={{
            marginTop: 64,
            padding: 24,
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            textAlign: 'center',
          }}
        >
          <h3 style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 8 }}>
            Need help?
          </h3>
          <p style={{ fontSize: 14, color: C.text2 }}>
            Contact us at{' '}
            <a href="mailto:jeff@revopsimpact.us" style={{ color: C.indigo, textDecoration: 'none' }}>
              jeff@revopsimpact.us
            </a>
          </p>
        </div>
      </div>
    </MarketingLayout>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 48 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: C.indigo,
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {number}
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 600, color: C.text }}>
          {title}
        </h2>
      </div>
      <div style={{ marginLeft: 48 }}>
        {children}
      </div>
    </div>
  );
}

function Screenshot({ label, width, height }: { label: string; width: number; height: number }) {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: width,
        height: height,
        background: C.surface,
        border: `2px dashed ${C.border}`,
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 13,
        color: C.text3,
        fontStyle: 'italic',
      }}
    >
      [Screenshot: {label}]
    </div>
  );
}
