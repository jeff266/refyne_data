'use client';

import { useState } from 'react';
import {
  X,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import type { Provider } from './KeyRow';

interface AddKeyModalProps {
  provider: Provider;
  isOpen: boolean;
  onClose: () => void;
  onSave: (key: string) => Promise<void>;
  onTest: (key: string) => Promise<boolean>;
}

export function AddKeyModal({
  provider,
  isOpen,
  onClose,
  onSave,
  onTest,
}: AddKeyModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testState, setTestState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [saveState, setSaveState] = useState<'idle' | 'loading'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const Icon = provider.icon;

  const handleTest = async () => {
    if (!apiKey.trim()) return;

    setTestState('loading');
    setErrorMessage(null);

    try {
      const success = await onTest(apiKey);
      setTestState(success ? 'success' : 'error');
      if (!success) {
        setErrorMessage('Connection test failed. Please verify your API key.');
      }
    } catch (err) {
      setTestState('error');
      setErrorMessage('Connection test failed. Please verify your API key.');
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim()) return;

    setSaveState('loading');
    setErrorMessage(null);

    try {
      await onSave(apiKey);
      handleClose();
    } catch (err) {
      setErrorMessage('Failed to save API key. Please try again.');
      setSaveState('idle');
    }
  };

  const handleClose = () => {
    setApiKey('');
    setShowKey(false);
    setTestState('idle');
    setSaveState('idle');
    setErrorMessage(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-mplc-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-mplc-gray-100 flex items-center justify-center">
              <Icon className="w-5 h-5 text-mplc-gray-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-mplc-gray-900">
                Add {provider.name} API Key
              </h2>
              <p className="text-sm text-mplc-gray-500">
                Connect your {provider.name} account
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-mplc-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-mplc-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-mplc-gray-600">
            {provider.description}. Enter your API key below to enable this provider.
          </p>

          {/* API Key Input */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-mplc-gray-700">
              API Key
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setTestState('idle');
                  setErrorMessage(null);
                }}
                placeholder="Enter your API key"
                className="w-full px-4 py-2.5 pr-10 border border-mplc-gray-300 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-mplc-black focus:border-transparent
                  text-sm placeholder:text-mplc-gray-400"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-mplc-gray-400 hover:text-mplc-gray-600"
              >
                {showKey ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Get API Key Link */}
          <a
            href={provider.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-mplc-gray-600 hover:text-mplc-black transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Get your API key from {provider.name}
          </a>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{errorMessage}</p>
            </div>
          )}

          {/* Test Success Message */}
          {testState === 'success' && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <p className="text-sm text-green-700">Connection successful!</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-mplc-gray-200 bg-mplc-gray-50 rounded-b-xl">
          <button
            onClick={handleTest}
            disabled={!apiKey.trim() || testState === 'loading'}
            className={`
              inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg
              border transition-all
              ${testState === 'success'
                ? 'border-green-300 bg-green-50 text-green-700'
                : testState === 'error'
                ? 'border-red-300 bg-red-50 text-red-700'
                : 'border-mplc-gray-300 hover:bg-white text-mplc-gray-700'
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            {testState === 'loading' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : testState === 'success' ? (
              <CheckCircle className="w-4 h-4" />
            ) : testState === 'error' ? (
              <XCircle className="w-4 h-4" />
            ) : null}
            Test Connection
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-mplc-gray-700 hover:bg-mplc-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!apiKey.trim() || saveState === 'loading'}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg
                bg-mplc-black text-white hover:bg-mplc-gray-800 transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saveState === 'loading' && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              Save Key
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
