'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

interface Segment {
  id: string;
  display_name: string;
  description: string;
  icon: string;
  visible: boolean;
  order: number;
  providers: {
    cascade: string[];
    fallback_enabled: boolean;
    fallback?: string[];
  };
  input_fields: any[];
}

interface Provider {
  name: string;
  type: string;
  env_key?: string;
  env_keys?: string[];
}

interface AddSegmentModalProps {
  providers: Record<string, Provider>;
  existingIds: string[];
  maxOrder: number;
  onAdd: (segment: Segment) => void;
  onClose: () => void;
}

export default function AddSegmentModal({
  providers,
  existingIds,
  maxOrder,
  onAdd,
  onClose,
}: AddSegmentModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedProvider, setSelectedProvider] = useState(Object.keys(providers)[0] || '');
  const [error, setError] = useState<string | null>(null);

  const generateId = (displayName: string): string => {
    // Convert display name to snake_case ID
    let id = displayName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

    // Ensure uniqueness
    if (!id) id = 'new_segment';
    let uniqueId = id;
    let counter = 1;
    while (existingIds.includes(uniqueId)) {
      uniqueId = `${id}_${counter}`;
      counter++;
    }

    return uniqueId;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please enter a segment name');
      return;
    }

    if (!description.trim()) {
      setError('Please enter a description');
      return;
    }

    if (!selectedProvider) {
      setError('Please select a provider');
      return;
    }

    const newSegment: Segment = {
      id: generateId(name),
      display_name: name.trim(),
      description: description.trim(),
      icon: 'search',
      visible: true,
      order: maxOrder + 1,
      providers: {
        cascade: [selectedProvider],
        fallback_enabled: false,
      },
      input_fields: [],
    };

    onAdd(newSegment);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-black">Add New Segment</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Segment Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Enterprise Accounts"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this segment is used for..."
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Primary Provider
              </label>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent bg-white"
              >
                {Object.entries(providers).map(([id, provider]) => (
                  <option key={id} value={id}>
                    {provider.name} ({provider.type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Preview */}
          {name && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-500 mb-2">Preview</p>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center">
                  <span className="text-gray-500 text-xs">{maxOrder + 1}</span>
                </div>
                <div>
                  <div className="font-medium text-black">{name}</div>
                  <div className="text-sm text-gray-500">
                    {description || 'No description'}
                  </div>
                </div>
              </div>
              <div className="mt-2">
                <code className="text-xs text-gray-500">ID: {generateId(name)}</code>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-full text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-black text-white rounded-full text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              Add Segment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
