'use client';

/**
 * RecordSource - Phase 9
 *
 * Interface for loading records to preview/apply normalization.
 * V1 implementation: CSV paste and JSON array.
 * Designed to accept HubSpot list pull as a second implementation later.
 */

import { useState, useCallback } from 'react';
import { Upload, FileText, X, AlertCircle } from 'lucide-react';
import type { RawRecord } from '@/lib/mcp/types';

/**
 * RecordSource interface - implementations must provide this.
 */
export interface RecordSourceResult {
  /** Successfully loaded records */
  records: RawRecord[];
  /** Source name for display */
  sourceName: string;
  /** Number of records */
  count: number;
  /** Any errors during loading */
  error?: string;
}

export interface RecordSourceProps {
  /** Callback when records are loaded */
  onRecordsLoaded: (result: RecordSourceResult) => void;
  /** Callback when records are cleared */
  onClear: () => void;
  /** Currently loaded records */
  loadedRecords: RawRecord[] | null;
  /** Source name if records are loaded */
  sourceName: string | null;
  /** Whether the source is disabled */
  disabled?: boolean;
}

/**
 * Parse CSV string to records.
 */
function parseCSV(csv: string): RawRecord[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  // Parse header row
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

  // Parse data rows
  const records: RawRecord[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const record: RawRecord = {
      _id: `row_${i}`,
    };

    headers.forEach((header, index) => {
      if (values[index] !== undefined) {
        record[header] = values[index];
      }
    });

    // Try to set a label from common fields
    const labelField = headers.find(h =>
      ['name', 'company_name', 'company', 'full_name', 'title'].includes(h.toLowerCase())
    );
    if (labelField && record[labelField]) {
      record._label = String(record[labelField]);
    }

    records.push(record);
  }

  return records;
}

/**
 * Parse a single CSV line, handling quoted values.
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

/**
 * Parse JSON string to records.
 */
function parseJSON(json: string): RawRecord[] {
  const data = JSON.parse(json);

  if (!Array.isArray(data)) {
    throw new Error('JSON must be an array of objects');
  }

  return data.map((item, index) => {
    const record: RawRecord = {
      _id: item._id || item.id || `record_${index + 1}`,
      ...item,
    };

    // Try to set a label from common fields
    if (!record._label) {
      const label = item.name || item.company_name || item.company || item.full_name;
      if (label) {
        record._label = String(label);
      }
    }

    return record;
  });
}

/**
 * CSV/JSON Record Source Component.
 */
export function CSVRecordSource({
  onRecordsLoaded,
  onClear,
  loadedRecords,
  sourceName,
  disabled = false,
}: RecordSourceProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');

  const processInput = useCallback((input: string, name: string) => {
    setError(null);

    try {
      // Try to detect format
      const trimmed = input.trim();
      let records: RawRecord[];

      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        // Likely JSON
        records = parseJSON(trimmed);
      } else {
        // Treat as CSV
        records = parseCSV(trimmed);
      }

      if (records.length === 0) {
        setError('No valid records found');
        return;
      }

      onRecordsLoaded({
        records,
        sourceName: name,
        count: records.length,
      });
      setInputValue('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse input');
    }
  }, [onRecordsLoaded]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text');
    if (text) {
      processInput(text, 'Pasted data');
    }
  }, [processInput]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        processInput(content, file.name);
      };
      reader.readAsText(file);
    }
  }, [processInput]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        processInput(content, file.name);
      };
      reader.readAsText(file);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  }, [processInput]);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
  }, []);

  const handleSubmit = useCallback(() => {
    if (inputValue.trim()) {
      processInput(inputValue, 'Manual input');
    }
  }, [inputValue, processInput]);

  // If records are loaded, show summary
  if (loadedRecords && loadedRecords.length > 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-mplc-gray-100 flex items-center justify-center">
            <FileText className="w-5 h-5 text-mplc-gray-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-mplc-gray-900">Records</h3>
            <p className="text-xs text-mplc-gray-500">
              {loadedRecords.length} records loaded
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 border border-mplc-gray-200 rounded-xl bg-mplc-gray-50">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-mplc-gray-500" />
            <div>
              <span className="text-sm font-medium text-mplc-gray-900">
                {loadedRecords.length} records
              </span>
              {sourceName && (
                <span className="text-xs text-mplc-gray-500 ml-2">
                  · {sourceName}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClear}
            disabled={disabled}
            className="p-2 text-mplc-gray-400 hover:text-mplc-gray-600 hover:bg-mplc-gray-200 rounded-lg
              disabled:opacity-50 transition-colors"
            title="Clear records"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Empty state - show drop zone
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-mplc-gray-100 flex items-center justify-center">
          <Upload className="w-5 h-5 text-mplc-gray-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-mplc-gray-900">Records</h3>
          <p className="text-xs text-mplc-gray-500">
            Load records to preview normalization
          </p>
        </div>
      </div>

      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onPaste={handlePaste}
        className={`
          relative border-2 border-dashed rounded-xl p-6 transition-colors
          ${isDragging
            ? 'border-primary bg-primary/5'
            : 'border-mplc-gray-300 hover:border-mplc-gray-400'
          }
          ${disabled ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        <div className="text-center">
          <Upload className="w-8 h-8 text-mplc-gray-400 mx-auto mb-3" />
          <p className="text-sm text-mplc-gray-600 mb-1">
            Drop CSV or JSON file here, or{' '}
            <label className="text-primary hover:underline cursor-pointer">
              browse
              <input
                type="file"
                accept=".csv,.json"
                onChange={handleFileSelect}
                className="sr-only"
                disabled={disabled}
              />
            </label>
          </p>
          <p className="text-xs text-mplc-gray-400">
            Or paste data directly (Cmd/Ctrl+V)
          </p>
        </div>

        {/* Text Input */}
        <div className="mt-4">
          <textarea
            value={inputValue}
            onChange={handleTextChange}
            placeholder="Paste CSV or JSON here..."
            className="w-full h-24 px-3 py-2 text-sm border border-mplc-gray-200 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
              resize-none"
            disabled={disabled}
          />
          {inputValue.trim() && (
            <div className="mt-2 flex justify-end">
              <button
                onClick={handleSubmit}
                className="px-3 py-1.5 text-sm font-medium text-white bg-primary rounded-lg
                  hover:bg-primary/90"
              >
                Load Records
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}
    </div>
  );
}

// Types are exported via the interface declarations above
