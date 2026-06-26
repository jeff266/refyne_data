'use client';

import { useState } from 'react';
import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import { C, F } from '@/lib/design-tokens';

export default function SupportPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    // Reset states
    setError(null);
    setSuccess(false);

    // Validate
    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      setError('All fields are required');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/support/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to send message');
      }

      setSuccess(true);
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Email us directly at support@refynedata.com');
    } finally {
      setLoading(false);
    }
  }

  return (
    <MarketingLayout>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '64px 32px' }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <h1 style={{ fontSize: 42, fontWeight: 600, color: C.text, marginBottom: 12, fontFamily: F.serif }}>
            Support
          </h1>
          <p style={{ fontSize: 16, color: C.text2 }}>
            Get help with Refyne. We typically respond within one business day.
          </p>
        </div>

        {/* FAQ Section */}
        <div style={{ marginBottom: 64 }}>
          <h2 style={{ fontSize: 28, fontWeight: 600, color: C.text, marginBottom: 32, fontFamily: F.serif }}>
            Frequently asked questions
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <FAQ
              question="How do I connect my HubSpot account?"
              answer="Go to Settings > Connections and click Connect HubSpot. You'll be redirected to HubSpot to authorize Refyne. After authorizing, you'll be returned to Refyne automatically."
            />
            <FAQ
              question="What HubSpot permissions does Refyne require?"
              answer="Refyne requires read and write access to CRM objects (companies and contacts), and access to your HubSpot properties schema. These scopes are requested during the OAuth connection flow."
            />
            <FAQ
              question="How does deduplication work?"
              answer="Refyne scans your CRM for duplicate companies and contacts using a 7-signal matching system including domain, LinkedIn URL, phone, name, industry, address, and executive overlap. Duplicates are grouped into clusters for your review before any merge is executed."
            />
            <FAQ
              question="Can I undo a merge?"
              answer="Yes. Refyne stores a pre-merge snapshot of every record before merging. Go to Dedup > History to find any past merge and restore the absorbed record."
            />
            <FAQ
              question="What is normalization?"
              answer="Normalization applies formatting rules (Harmonies) to your CRM data -- standardizing phone numbers to E.164 format, LinkedIn URLs to canonical form, names to title case, and more. You can preview changes before writing anything to HubSpot."
            />
            <FAQ
              question="What are credits used for?"
              answer="Credits are consumed by managed enrichment providers (Refyne Search). Each enriched record costs 1 credit. BYOK providers (Apollo, ZoomInfo, Cognism) use your own API keys and do not consume Refyne credits."
            />
            <FAQ
              question="How do I add team members?"
              answer="Go to Settings > Team and invite teammates by email. They will receive an invitation to join your Refyne workspace."
            />
            <FAQ
              question="What happens when my trial expires?"
              answer="Your data remains intact and read access is preserved. Write actions (merges, normalize runs, enrichment) are paused until you upgrade. You can upgrade at any time from Settings > Billing."
            />
          </div>
        </div>

        {/* Contact Form Section */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 48 }}>
          <h2 style={{ fontSize: 28, fontWeight: 600, color: C.text, marginBottom: 8, fontFamily: F.serif }}>
            Still need help?
          </h2>
          <p style={{ fontSize: 16, color: C.text2, marginBottom: 32 }}>
            Send us a message and we'll get back to you.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 14, color: C.text2, marginBottom: 6, fontWeight: 500 }}>
                Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: 12,
                  fontSize: 14,
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  borderRadius: 0,
                  color: C.text,
                  fontFamily: F.sans,
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 14, color: C.text2, marginBottom: 6, fontWeight: 500 }}>
                Email *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: 12,
                  fontSize: 14,
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  borderRadius: 0,
                  color: C.text,
                  fontFamily: F.sans,
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 14, color: C.text2, marginBottom: 6, fontWeight: 500 }}>
                Subject *
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: 12,
                  fontSize: 14,
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  borderRadius: 0,
                  color: C.text,
                  fontFamily: F.sans,
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 14, color: C.text2, marginBottom: 6, fontWeight: 500 }}>
                Message *
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={loading}
                rows={6}
                style={{
                  width: '100%',
                  padding: 12,
                  fontSize: 14,
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  borderRadius: 0,
                  color: C.text,
                  fontFamily: F.sans,
                  resize: 'vertical',
                }}
              />
            </div>

            {success && (
              <div style={{
                padding: 12,
                background: '#22c55e20',
                border: `1px solid #22c55e`,
                color: '#22c55e',
                fontSize: 14,
                borderRadius: 0,
              }}>
                Message sent. We'll be in touch within one business day.
              </div>
            )}

            {error && (
              <div style={{
                padding: 12,
                background: C.red + '20',
                border: `1px solid ${C.red}`,
                color: C.red,
                fontSize: 14,
                borderRadius: 0,
              }}>
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px 24px',
                fontSize: 14,
                fontWeight: 600,
                background: loading ? C.text3 : C.indigo,
                color: '#fff',
                border: 'none',
                borderRadius: 0,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                fontFamily: F.sans,
              }}
            >
              {loading ? 'Sending...' : 'Send message'}
            </button>
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
}

function FAQ({ question, answer }: { question: string; answer: string }) {
  return (
    <div style={{ paddingBottom: 24, borderBottom: `1px solid ${C.border}` }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 8 }}>
        {question}
      </h3>
      <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6 }}>
        {answer}
      </p>
    </div>
  );
}
