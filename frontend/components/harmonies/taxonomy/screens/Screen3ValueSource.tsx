/**
 * Screen 3: Choose Canonical Values Source
 *
 * User selects where to get canonical values from:
 * - Pack (pre-built taxonomy)
 * - Field (read from existing HubSpot field)
 * - Blank (start from scratch)
 */

'use client';

import { C, F } from '@/lib/design-tokens';
import { HubSpotPropertyPicker } from '../../HubSpotPropertyPicker';
import { PackCard } from '../components/PackCard';
import type { Pack } from '../hooks/useTaxonomyWizard';

interface Screen3Props {
  valueSource: 'pack' | 'field' | 'blank';
  packs: Pack[];
  selectedPack: Pack | null;
  loadingPacks: boolean;
  readFromField: string;
  readFromFieldLabel: string;
  onValueSourceChange: (source: 'pack' | 'field' | 'blank') => void;
  onPackSelect: (pack: Pack) => void;
  onReadFromFieldChange: (name: string, label: string) => void;
}

export function Screen3ValueSource({
  valueSource,
  packs,
  selectedPack,
  loadingPacks,
  readFromField,
  onValueSourceChange,
  onPackSelect,
  onReadFromFieldChange,
}: Screen3Props) {
  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 24 }}>
        Define your canonical values
      </h3>

      <div style={{ marginBottom: 32 }}>
        <h4 style={{ fontSize: 13, fontWeight: 600, color: C.text2, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          START FROM A PACK (RECOMMENDED)
        </h4>

        {loadingPacks ? (
          <div style={{ padding: 40, textAlign: 'center', color: C.text3 }}>
            Loading packs...
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 16,
          }}>
            {packs.map((pack) => (
              <PackCard
                key={pack.id}
                pack={pack}
                isSelected={selectedPack?.id === pack.id}
                onSelect={(pack) => {
                  onPackSelect(pack);
                  onValueSourceChange('pack');
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <h4 style={{ fontSize: 13, fontWeight: 600, color: C.text2, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          OR READ FROM YOUR EXISTING FIELD
        </h4>
        <button
          onClick={() => onValueSourceChange('field')}
          style={{
            width: '100%',
            padding: '12px 20px',
            background: valueSource === 'field' ? C.indigoDim : 'transparent',
            border: `1px solid ${valueSource === 'field' ? C.indigo : C.border}`,
            color: C.text,
            fontSize: 13,
            cursor: 'pointer',
            fontFamily: F.sans,
            textAlign: 'left',
          }}
        >
          Read from HubSpot field
        </button>
        {valueSource === 'field' && (
          <div style={{ marginTop: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: C.text2, marginBottom: 8 }}>
              SELECT FIELD TO READ FROM
            </label>
            <HubSpotPropertyPicker
              objectType="company"
              value={readFromField}
              onChange={onReadFromFieldChange}
              placeholder="Select field with canonical values..."
            />
          </div>
        )}
      </div>

      <div>
        <h4 style={{ fontSize: 13, fontWeight: 600, color: C.text2, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          OR START BLANK
        </h4>
        <button
          onClick={() => onValueSourceChange('blank')}
          style={{
            padding: '12px 20px',
            background: valueSource === 'blank' ? C.indigoDim : 'transparent',
            border: `1px solid ${C.border}`,
            color: C.text,
            fontSize: 13,
            cursor: 'pointer',
            fontFamily: F.sans,
          }}
        >
          I'll define my own canonical values
        </button>
      </div>
    </div>
  );
}
