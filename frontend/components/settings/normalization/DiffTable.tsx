'use client';

/**
 * DiffTable - Phase 9
 *
 * Displays preview results with Current vs After values.
 * Groups rows by record with the record name as a section header.
 * Shows [parse failed] for Harmony errors without crashing.
 */

import { useState, useMemo } from 'react';
import { Check, Minus, X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { HarmoniesPreviewOutput, RecordPreviewResult, FieldPreviewResult } from '@/lib/mcp/types';

interface DiffTableProps {
  /** Preview output from harmonies_preview */
  previewData: HarmoniesPreviewOutput | null;
  /** Whether data is loading */
  isLoading?: boolean;
  /** Page size */
  pageSize?: number;
}

/**
 * Format a value for display.
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Status icon component.
 */
function StatusIcon({ status }: { status: 'changed' | 'unchanged' | 'error' }) {
  switch (status) {
    case 'changed':
      return (
        <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
          <Check className="w-3 h-3 text-green-600" />
        </div>
      );
    case 'unchanged':
      return (
        <div className="w-5 h-5 rounded-full bg-mplc-gray-100 flex items-center justify-center">
          <Minus className="w-3 h-3 text-mplc-gray-400" />
        </div>
      );
    case 'error':
      return (
        <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center">
          <X className="w-3 h-3 text-red-600" />
        </div>
      );
  }
}

/**
 * Field row component within a record.
 */
function FieldRow({ field, isLast }: { field: FieldPreviewResult; isLast: boolean }) {
  const currentDisplay = formatValue(field.current);
  const projectedDisplay = field.status === 'error'
    ? '[parse failed]'
    : formatValue(field.projected);

  return (
    <tr className={!isLast ? 'border-b border-mplc-gray-100' : ''}>
      <td className="pl-8 pr-4 py-2">
        <span className="text-xs font-mono text-mplc-gray-500">
          .{field.field.split('.').pop()}
        </span>
      </td>
      <td className="px-4 py-2">
        <span className={`text-sm ${field.status === 'changed' ? 'text-mplc-gray-500 line-through' : 'text-mplc-gray-700'}`}>
          {currentDisplay}
        </span>
      </td>
      <td className="px-4 py-2">
        <span className={`text-sm ${
          field.status === 'error'
            ? 'text-red-600 font-medium'
            : field.status === 'changed'
              ? 'text-mplc-gray-900 font-medium'
              : 'text-mplc-gray-700'
        }`}>
          {projectedDisplay}
        </span>
        {field.error && (
          <span className="block text-xs text-red-500 mt-0.5" title={field.error}>
            {field.error.slice(0, 50)}...
          </span>
        )}
      </td>
      <td className="px-4 py-2 text-center">
        <StatusIcon status={field.status} />
      </td>
    </tr>
  );
}

/**
 * Record group component.
 */
function RecordGroup({ record }: { record: RecordPreviewResult }) {
  // Filter to only show fields with values
  const relevantFields = record.fields.filter(f =>
    f.current !== null && f.current !== undefined && f.current !== ''
  );

  if (relevantFields.length === 0) {
    return null;
  }

  return (
    <>
      {/* Record Header */}
      <tr className="bg-mplc-gray-50 border-b border-mplc-gray-200">
        <td colSpan={4} className="px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-mplc-gray-900">
              {record.record_label}
            </span>
            <StatusIcon status={record.status} />
          </div>
        </td>
      </tr>
      {/* Field Rows */}
      {relevantFields.map((field, idx) => (
        <FieldRow
          key={`${record.record_id}-${field.field}`}
          field={field}
          isLast={idx === relevantFields.length - 1}
        />
      ))}
    </>
  );
}

/**
 * Coverage summary component.
 */
function CoverageSummary({ summary }: { summary: HarmoniesPreviewOutput['summary'] }) {
  return (
    <div className="flex items-center gap-4 text-sm">
      <span className="text-mplc-gray-700">
        <strong className="text-green-600">{summary.changed}</strong>
        {' '}will change
      </span>
      <span className="text-mplc-gray-400">·</span>
      <span className="text-mplc-gray-700">
        <strong className="text-mplc-gray-500">{summary.unchanged}</strong>
        {' '}unchanged
      </span>
      {summary.errors > 0 && (
        <>
          <span className="text-mplc-gray-400">·</span>
          <span className="text-mplc-gray-700">
            <strong className="text-red-600">{summary.errors}</strong>
            {' '}error{summary.errors !== 1 ? 's' : ''}
          </span>
        </>
      )}
    </div>
  );
}

/**
 * Pagination component.
 */
function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-1.5 rounded-md text-mplc-gray-500 hover:text-mplc-gray-700 hover:bg-mplc-gray-100
            disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm text-mplc-gray-600">
          Page {currentPage} of {totalPages}
        </span>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded-md text-mplc-gray-500 hover:text-mplc-gray-700 hover:bg-mplc-gray-100
            disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-mplc-gray-500">
        <div className="flex items-center gap-1.5">
          <StatusIcon status="changed" />
          <span>changed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <StatusIcon status="unchanged" />
          <span>unchanged</span>
        </div>
        <div className="flex items-center gap-1.5">
          <StatusIcon status="error" />
          <span>error</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Main DiffTable component.
 */
export function DiffTable({
  previewData,
  isLoading = false,
  pageSize = 10,
}: DiffTableProps) {
  const [currentPage, setCurrentPage] = useState(1);

  // Paginate results
  const paginatedResults = useMemo(() => {
    if (!previewData) return [];
    const start = (currentPage - 1) * pageSize;
    return previewData.results.slice(start, start + pageSize);
  }, [previewData, currentPage, pageSize]);

  const totalPages = previewData
    ? Math.ceil(previewData.results.length / pageSize)
    : 0;

  // Reset to page 1 when data changes
  useMemo(() => {
    setCurrentPage(1);
  }, [previewData]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-48 bg-mplc-gray-200 rounded animate-pulse" />
        <div className="border border-mplc-gray-200 rounded-xl overflow-hidden">
          <div className="h-64 bg-mplc-gray-50 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!previewData) {
    return null;
  }

  if (previewData.results.length === 0) {
    return (
      <div className="p-8 text-center border border-mplc-gray-200 rounded-xl bg-mplc-gray-50">
        <p className="text-sm text-mplc-gray-600">No changes to preview</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Coverage Summary */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-mplc-gray-900">Preview</h3>
        <CoverageSummary summary={previewData.summary} />
      </div>

      {/* Table */}
      <div className="border border-mplc-gray-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-mplc-gray-50 border-b border-mplc-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-mplc-gray-500 uppercase tracking-wider w-1/4">
                Record
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-mplc-gray-500 uppercase tracking-wider w-1/4">
                Current
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-mplc-gray-500 uppercase tracking-wider w-1/4">
                After
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-mplc-gray-500 uppercase tracking-wider w-16">

              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-mplc-gray-200">
            {paginatedResults.map(record => (
              <RecordGroup key={record.record_id} record={record} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
}
