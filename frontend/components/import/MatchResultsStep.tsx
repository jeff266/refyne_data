'use client';

/**
 * MatchResultsStep Component
 *
 * Step 4 of import wizard - Show match results with expandable bucket cards
 */

import { useState } from 'react';
import { ArrowRight, ArrowLeft, ChevronUp, Download } from 'lucide-react';

interface MatchSummary {
  customer: number;
  open_deal: number;
  former_customer: number;
  known_contact: number;
  new_contact: number;
  needs_review: number;
}

interface SampleRow {
  email: string;
  first_name?: string;
  last_name?: string;
  job_title?: string;
  company?: string;
  match_type: string;
  confidence: number;
  review_reason?: string;
}

interface MatchResultsStepProps {
  sessionId: string;
  matchSummary: MatchSummary;
  sampleRows: Record<keyof MatchSummary, SampleRow[]>;
  totalRows: number;
  filteredRows: number;
  onBack: () => void;
  onContinue: () => void;
}

type Bucket = keyof MatchSummary;

const BUCKET_LABELS: Record<Bucket, string> = {
  customer: 'Customer',
  open_deal: 'Open Deal',
  former_customer: 'Former Customer',
  known_contact: 'Known Contact',
  new_contact: 'New Contact',
  needs_review: 'Needs Review',
};

const MATCH_TYPE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  email: { bg: 'bg-green-600/20', text: 'text-green-400', label: 'Email' },
  linkedin: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'LinkedIn' },
  company_fuzzy: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Company' },
  none: { bg: 'bg-zinc-700/50', text: 'text-zinc-500', label: 'None' },
};

export function MatchResultsStep({
  sessionId,
  matchSummary,
  sampleRows,
  totalRows,
  filteredRows,
  onBack,
  onContinue,
}: MatchResultsStepProps) {
  const [expandedBucket, setExpandedBucket] = useState<Bucket | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 20;

  const handleCardClick = (bucket: Bucket) => {
    if (matchSummary[bucket] === 0) return; // Don't expand zero-count cards

    if (expandedBucket === bucket) {
      // Collapse if already expanded
      setExpandedBucket(null);
    } else {
      // Expand new bucket
      setExpandedBucket(bucket);
      setCurrentPage(1); // Reset pagination
    }
  };

  const handleDownloadBucket = (bucket: Bucket) => {
    const date = new Date().toISOString().split('T')[0];
    window.location.href = `/api/import/${sessionId}/bucket/${bucket}/export`;
  };

  const totalMatched = Object.values(matchSummary).reduce((sum, count) => sum + count, 0);
  const filteredOut = totalRows - filteredRows;

  // Get current page rows
  const getPagedRows = (bucket: Bucket) => {
    const rows = sampleRows[bucket] || [];
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return rows.slice(startIndex, endIndex);
  };

  const totalPages = (bucket: Bucket) => {
    const rows = sampleRows[bucket] || [];
    return Math.ceil(rows.length / rowsPerPage);
  };

  return (
    <div>
      <h2 className="text-lg font-medium text-white mb-4">Step 4: Match Results</h2>

      {/* Bucket cards grid */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {(Object.entries(matchSummary) as [Bucket, number][]).map(([bucket, count]) => {
          const isExpanded = expandedBucket === bucket;
          const isClickable = count > 0;

          return (
            <div
              key={bucket}
              onClick={() => {
                if (isClickable) {
                  handleCardClick(bucket);
                }
              }}
              role={isClickable ? 'button' : undefined}
              tabIndex={isClickable ? 0 : undefined}
              onKeyDown={(e) => {
                if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  handleCardClick(bucket);
                }
              }}
              className={`p-4 bg-zinc-800 border transition-colors ${
                isClickable ? 'cursor-pointer' : 'cursor-default'
              } ${
                isExpanded
                  ? 'border-blue-500'
                  : isClickable
                  ? 'border-zinc-700 hover:border-blue-500/50'
                  : 'border-zinc-700'
              }`}
            >
              <div className="text-2xl font-semibold text-white mb-1">{count}</div>
              <div className="text-sm text-zinc-400 capitalize mb-2">
                {BUCKET_LABELS[bucket]}
              </div>
              {isClickable && (
                <div className="text-xs text-zinc-500">View contacts →</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Total count */}
      <div className="mb-6 text-sm text-zinc-400">
        {totalMatched} of {filteredRows} contacts matched
        {filteredOut > 0 && ` (${filteredOut} filtered out)`}
      </div>

      {/* Expanded table */}
      {expandedBucket && (
        <div className="mb-6 bg-zinc-900 border border-zinc-700">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-zinc-700">
            <h3 className="text-sm font-medium text-white">
              {BUCKET_LABELS[expandedBucket]} - {matchSummary[expandedBucket]} contacts
            </h3>
            <button
              onClick={() => setExpandedBucket(null)}
              className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white"
            >
              Collapse
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-700">
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">
                    Company
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">
                    Job Title
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">
                    Match
                  </th>
                  {expandedBucket === 'needs_review' && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">
                      Review Reason
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {getPagedRows(expandedBucket).map((row, idx) => {
                  const matchStyle = MATCH_TYPE_STYLES[row.match_type] || MATCH_TYPE_STYLES.none;
                  const name = `${row.first_name || ''} ${row.last_name || ''}`.trim() || '—';

                  return (
                    <tr key={idx} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                      <td className="px-4 py-3 text-sm text-white">{name}</td>
                      <td className="px-4 py-3 text-sm text-zinc-300">{row.email}</td>
                      <td className="px-4 py-3 text-sm text-zinc-300">{row.company || '—'}</td>
                      <td className="px-4 py-3 text-sm text-zinc-300">{row.job_title || '—'}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-1 text-xs font-medium ${matchStyle.bg} ${matchStyle.text}`}
                        >
                          {matchStyle.label}
                        </span>
                      </td>
                      {expandedBucket === 'needs_review' && (
                        <td className="px-4 py-3 text-sm text-zinc-500">
                          {row.review_reason || '—'}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination and download */}
          <div className="flex items-center justify-between p-4 border-t border-zinc-700">
            <div className="flex items-center gap-4">
              <span className="text-sm text-zinc-400">
                showing {(currentPage - 1) * rowsPerPage + 1}-
                {Math.min(currentPage * rowsPerPage, matchSummary[expandedBucket])} of{' '}
                {matchSummary[expandedBucket]}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm text-zinc-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ← Prev
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages(expandedBucket), p + 1))}
                  disabled={currentPage === totalPages(expandedBucket)}
                  className="px-3 py-1 text-sm text-zinc-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            </div>
            <button
              onClick={() => handleDownloadBucket(expandedBucket)}
              className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
            >
              Download this bucket
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white flex items-center gap-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <button
          onClick={onContinue}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2 transition-colors"
        >
          Continue
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
