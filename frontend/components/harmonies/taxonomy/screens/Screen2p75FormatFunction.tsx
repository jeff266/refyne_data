/**
 * Screen 2.75: Format Function Picker
 *
 * User selects a specific format function to apply.
 */

'use client';

import { C } from '@/lib/design-tokens';
import { FormatFunctionPicker } from '../../FormatFunctionPicker';

interface Screen2p75Props {
  selectedFormatFunction: string | null;
  onSelect: (functionName: string | null) => void;
}

export function Screen2p75FormatFunction({ selectedFormatFunction, onSelect }: Screen2p75Props) {
  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 24 }}>
        Select a format function
      </h3>

      <FormatFunctionPicker
        selectedFunction={selectedFormatFunction}
        onSelect={onSelect}
        objectType="company"
      />
    </div>
  );
}
