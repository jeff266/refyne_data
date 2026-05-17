'use client';

import { useState } from 'react';
import { Sparkles, Download, Check, Loader2 } from 'lucide-react';

interface BulkActionsProps {
  selectedCount: number;
  onGenerateBriefs: () => Promise<void>;
  onExportCSV: () => void;
  disabled?: boolean;
}

export default function BulkActions({
  selectedCount,
  onGenerateBriefs,
  onExportCSV,
  disabled = false,
}: BulkActionsProps) {
  const [generating, setGenerating] = useState(false);
  const [generationComplete, setGenerationComplete] = useState(false);

  const handleGenerateBriefs = async () => {
    if (generating || disabled) return;
    setGenerating(true);
    setGenerationComplete(false);
    try {
      await onGenerateBriefs();
      setGenerationComplete(true);
      setTimeout(() => setGenerationComplete(false), 3000);
    } catch (error) {
      console.error('Failed to generate briefs:', error);
    } finally {
      setGenerating(false);
    }
  };

  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in">
      <div className="bg-mplc-black text-mplc-white rounded-full shadow-lg px-6 py-3 flex items-center space-x-6">
        {/* Selection count */}
        <div className="flex items-center space-x-2">
          <span className="bg-mplc-white/20 px-2 py-0.5 rounded-full text-sm font-medium">
            {selectedCount}
          </span>
          <span className="text-mplc-gray-300 text-sm">selected</span>
        </div>

        <div className="w-px h-6 bg-mplc-gray-600" />

        {/* Generate AI Briefs */}
        <button
          onClick={handleGenerateBriefs}
          disabled={generating || disabled}
          className={`flex items-center space-x-2 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            generationComplete
              ? 'bg-green-500 text-white'
              : 'bg-mplc-white text-mplc-black hover:bg-mplc-gray-100'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {generating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Generating...</span>
            </>
          ) : generationComplete ? (
            <>
              <Check className="w-4 h-4" />
              <span>Briefs Generated</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Generate AI Briefs</span>
            </>
          )}
        </button>

        {/* Export CSV */}
        <button
          onClick={onExportCSV}
          disabled={disabled}
          className="flex items-center space-x-2 px-4 py-1.5 rounded-full text-sm font-medium bg-transparent border border-mplc-gray-600 hover:bg-mplc-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          <span>Export CSV</span>
        </button>
      </div>
    </div>
  );
}
