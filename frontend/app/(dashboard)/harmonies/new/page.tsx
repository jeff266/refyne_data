'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import { Card, PrimaryBtn, GhostBtn } from '@/components/refyne';

export default function NewHarmonyPage() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [objectType, setObjectType] = useState<'company' | 'contact'>('company');
  const [transformType, setTransformType] = useState<'lookup' | 'format'>('lookup');
  const [writePolicy, setWritePolicy] = useState<'always_overwrite' | 'fill_empty' | 'never_overwrite'>('fill_empty');

  const handleCreate = async () => {
    if (!name.trim()) {
      alert('Please enter a harmony name');
      return;
    }

    setCreating(true);

    try {
      const res = await fetch('/api/harmonies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          objectType,
          transformType,
          writePolicy,
          isActive: false, // Start inactive
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create harmony');
      }

      const { harmony } = await res.json();

      // Redirect to the harmony detail page
      router.push(`/harmonies/${harmony.id}`);
    } catch (err) {
      console.error('Failed to create harmony:', err);
      alert(err instanceof Error ? err.message : 'Failed to create harmony');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ padding: 32, background: C.bg, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <button
          onClick={() => router.back()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 0',
            background: 'none',
            border: 'none',
            color: C.text2,
            fontSize: 14,
            cursor: 'pointer',
            marginBottom: 16,
          }}
        >
          <ArrowLeft size={16} />
          Back
        </button>

        <h1 style={{ fontSize: 28, fontWeight: 600, color: C.text, fontFamily: F.sans, margin: 0 }}>
          Create New Harmony
        </h1>
        <p style={{ fontSize: 14, color: C.text2, marginTop: 8 }}>
          Define a custom data normalization rule for your HubSpot records
        </p>
      </div>

      {/* Form */}
      <Card style={{ maxWidth: 600, padding: 32 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Name */}
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: C.text, marginBottom: 8 }}>
              Harmony Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Industry Taxonomy, Job Title Normalization"
              style={{
                width: '100%',
                padding: '10px 12px',
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                color: C.text,
                fontSize: 14,
                fontFamily: F.sans,
              }}
            />
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: C.text, marginBottom: 8 }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this harmony do?"
              rows={3}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                color: C.text,
                fontSize: 14,
                fontFamily: F.sans,
                resize: 'vertical',
              }}
            />
          </div>

          {/* Object Type */}
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: C.text, marginBottom: 8 }}>
              Object Type *
            </label>
            <select
              value={objectType}
              onChange={(e) => setObjectType(e.target.value as 'company' | 'contact')}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                color: C.text,
                fontSize: 14,
                fontFamily: F.sans,
                cursor: 'pointer',
              }}
            >
              <option value="company">Company</option>
              <option value="contact">Contact</option>
            </select>
          </div>

          {/* Transform Type */}
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: C.text, marginBottom: 8 }}>
              Transform Type *
            </label>
            <select
              value={transformType}
              onChange={(e) => setTransformType(e.target.value as 'lookup' | 'format')}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                color: C.text,
                fontSize: 14,
                fontFamily: F.sans,
                cursor: 'pointer',
              }}
            >
              <option value="lookup">Lookup (reference table)</option>
              <option value="format">Format (transform function)</option>
            </select>
            <p style={{ fontSize: 12, color: C.text3, marginTop: 6 }}>
              {transformType === 'lookup'
                ? 'Uses a reference table to map input values to canonical values'
                : 'Uses a JavaScript function to transform input values'}
            </p>
          </div>

          {/* Write Policy */}
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: C.text, marginBottom: 8 }}>
              Write Policy *
            </label>
            <select
              value={writePolicy}
              onChange={(e) => setWritePolicy(e.target.value as any)}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                color: C.text,
                fontSize: 14,
                fontFamily: F.sans,
                cursor: 'pointer',
              }}
            >
              <option value="fill_empty">Fill empty (recommended)</option>
              <option value="always_overwrite">Always overwrite</option>
              <option value="never_overwrite">Never overwrite</option>
            </select>
            <p style={{ fontSize: 12, color: C.text3, marginTop: 6 }}>
              {writePolicy === 'fill_empty' && 'Only write to empty fields in HubSpot'}
              {writePolicy === 'always_overwrite' && 'Always write, overwriting existing values'}
              {writePolicy === 'never_overwrite' && 'Never write to HubSpot (staging only)'}
            </p>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <PrimaryBtn onClick={handleCreate} disabled={creating || !name.trim()}>
              {creating ? 'Creating...' : 'Create Harmony'}
            </PrimaryBtn>
            <GhostBtn onClick={() => router.back()} disabled={creating}>
              Cancel
            </GhostBtn>
          </div>
        </div>
      </Card>
    </div>
  );
}
