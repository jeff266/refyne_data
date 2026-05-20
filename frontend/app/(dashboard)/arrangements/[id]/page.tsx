'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { C } from '@/lib/design-tokens';

export default function ArrangementEditPage({ params }: { params: { id: string } }) {
  const router = useRouter();

  return (
    <div style={{ padding: 32, maxWidth: 800, margin: '0 auto' }}>
      <button
        onClick={() => router.push('/arrangements')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          background: 'transparent',
          border: 'none',
          color: C.text2,
          fontSize: 14,
          cursor: 'pointer',
          marginBottom: 24,
        }}
      >
        <ChevronLeft size={16} />
        Back to arrangements
      </button>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          padding: 32,
        }}
      >
        <div style={{ fontSize: 64, marginBottom: 24 }}>🚧</div>
        <h2
          style={{
            fontSize: 24,
            fontWeight: 600,
            color: C.text,
            marginBottom: 8,
          }}
        >
          Edit Arrangement
        </h2>
        <p
          style={{
            fontSize: 14,
            color: C.text2,
            marginBottom: 24,
            textAlign: 'center',
            maxWidth: 480,
          }}
        >
          Arrangement editing is coming soon. For now, you can create a new arrangement or view
          your existing arrangements from the list.
        </p>
        <button
          onClick={() => router.push('/arrangements')}
          style={{
            padding: '10px 20px',
            background: C.indigo,
            color: 'white',
            border: 'none',
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Back to Arrangements
        </button>
      </div>
    </div>
  );
}
