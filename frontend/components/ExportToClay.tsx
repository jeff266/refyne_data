'use client';

import { useState } from 'react';
import { Download, Copy, Check, ExternalLink } from 'lucide-react';

interface ExportToClayProps {
  records: any[];
  disabled?: boolean;
}

export default function ExportToClay({ records, disabled = false }: ExportToClayProps) {
  const [copied, setCopied] = useState(false);
  const [format, setFormat] = useState<'json' | 'csv'>('csv');

  const generateCSV = () => {
    if (records.length === 0) return '';

    // Get all unique keys across all records
    const allKeys = new Set<string>();
    records.forEach(record => {
      Object.keys(record).forEach(key => {
        if (!key.startsWith('_')) allKeys.add(key);
      });
    });

    const headers = Array.from(allKeys);
    const headerRow = headers.join(',');

    const dataRows = records.map(record => {
      return headers.map(header => {
        const value = record[header];
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        // Escape quotes and wrap in quotes if contains comma or quote
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',');
    });

    return [headerRow, ...dataRows].join('\n');
  };

  const generateJSON = () => {
    // Clean records - remove internal fields
    const cleanRecords = records.map(record => {
      const clean: Record<string, any> = {};
      Object.entries(record).forEach(([key, value]) => {
        if (!key.startsWith('_')) {
          clean[key] = value;
        }
      });
      return clean;
    });
    return JSON.stringify(cleanRecords, null, 2);
  };

  const handleCopy = () => {
    const content = format === 'csv' ? generateCSV() : generateJSON();
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const content = format === 'csv' ? generateCSV() : generateJSON();
    const blob = new Blob([content], {
      type: format === 'csv' ? 'text/csv' : 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `enrichment-export-${Date.now()}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (records.length === 0) {
    return null;
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">
            Export to Clay
          </span>
          <span className="text-xs text-gray-500">
            ({records.length} records)
          </span>
        </div>
        <a
          href="https://www.clay.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          Open Clay
          <ExternalLink size={12} />
        </a>
      </div>

      <div className="flex items-center gap-2">
        {/* Format selector */}
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value as 'json' | 'csv')}
          className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10"
        >
          <option value="csv">CSV</option>
          <option value="json">JSON</option>
        </select>

        {/* Copy button */}
        <button
          onClick={handleCopy}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-white transition-colors disabled:opacity-50"
        >
          {copied ? (
            <>
              <Check size={14} className="text-green-500" />
              Copied
            </>
          ) : (
            <>
              <Copy size={14} />
              Copy
            </>
          )}
        </button>

        {/* Download button */}
        <button
          onClick={handleDownload}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          <Download size={14} />
          Download
        </button>
      </div>

      <p className="text-xs text-gray-500 mt-3">
        Import this file into a Clay table for Claygent AI enrichment.
      </p>
    </div>
  );
}
