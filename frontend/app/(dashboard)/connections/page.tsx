'use client';

import { useState, useEffect } from 'react';
import { Database } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import { Card, Chip, GhostBtn, StatusDot } from '@/components/refyne';

interface Connection {
  orgId: string;
  portalId: number;
  name: string;
  companyCount: number;
  lastSync: string;
}

// Available providers remain static until OAuth is implemented
const available = [
  { name: 'Apollo.io',  desc: 'People and company data', tag: 'Enrichment' },
  { name: 'ZoomInfo',   desc: 'B2B contact database',    tag: 'Enrichment' },
  { name: 'Serper',     desc: 'Web search API',          tag: 'Research' },
  { name: 'TinyFish',   desc: 'Web agent automation',    tag: 'Research' },
  { name: 'ProxyCurl',  desc: 'LinkedIn company data',   tag: 'Enrichment' },
  { name: 'Clearbit',   desc: 'Real-time enrichment',    tag: 'Enrichment' },
];

function tagColor(t: string): 'indigo' | 'green' {
  return t === 'Research' ? 'indigo' : 'green';
}

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConnections = async () => {
      try {
        const res = await fetch('/api/connections');
        if (res.ok) {
          const data = await res.json();
          setConnections(data.connections || []);
        }
      } catch (err) {
        console.error('Failed to fetch connections:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchConnections();
  }, []);
  if (loading) {
    return (
      <div style={{ padding: '28px 32px', fontFamily: F.sans }}>
        <div style={{ fontSize: 13, color: C.text3 }}>Loading connections...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 32px', fontFamily: F.sans, maxWidth: 820 }}>
      {/* Connected section */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, color: C.text3, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 14 }}>Connected</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {connections.map((conn) => (
            <Card key={conn.portalId} style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: C.indigoDim, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${C.indigoBrd}` }}>
                  <Database size={15} color={C.indigoLt} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                    <span style={{ fontSize: 13, color: C.text, fontWeight: 600, letterSpacing: '-0.01em' }}>HubSpot</span>
                    <span style={{ fontSize: 11, color: C.text3 }}>·</span>
                    <span style={{ fontSize: 12, color: C.text2 }}>{conn.name}</span>
                    <Chip color="green">CRM</Chip>
                  </div>
                  <div style={{ fontSize: 11, fontFamily: F.mono, color: C.text3 }}>
                    {conn.companyCount.toLocaleString()} companies · synced {conn.lastSync}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <StatusDot />
                <span style={{ fontSize: 11, color: C.green }}>Active</span>
                <GhostBtn>Manage</GhostBtn>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Available section */}
      <div>
        <div style={{ fontSize: 11, color: C.text3, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 14 }}>Available</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {available.map((c, i) => (
            <Card key={i} style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                  <span style={{ fontSize: 13, color: C.text, fontWeight: 600, letterSpacing: '-0.01em' }}>{c.name}</span>
                  <Chip color={tagColor(c.tag)}>{c.tag}</Chip>
                </div>
                <div style={{ fontSize: 11, color: C.text3 }}>{c.desc}</div>
              </div>
              <button style={{ padding: '5px 12px', border: `1px solid ${C.indigoBrd}`, color: C.indigoLt, borderRadius: 7, fontSize: 11, fontWeight: 500, marginLeft: 14, flexShrink: 0, background: C.indigoDim, cursor: 'pointer' }}>Connect</button>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
