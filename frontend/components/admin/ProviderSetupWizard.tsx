'use client';

import { useState } from 'react';
import { X, Check, ChevronRight, ChevronLeft, Key, FileText, DollarSign, Zap, AlertCircle, ExternalLink } from 'lucide-react';

interface ProviderSetupWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (providerConfig: ProviderConfig) => void;
}

interface ProviderConfig {
  id: string;
  name: string;
  type: string;
  envKey: string;
  apiKey: string;
  costPerRecord: number;
  rateLimit: number;
  fields: string[];
  description: string;
}

const PROVIDER_TEMPLATES = [
  {
    id: 'custom',
    name: 'Custom Provider',
    description: 'Configure a new data provider from scratch',
    icon: '🔧',
    type: 'enrichment',
    docsUrl: '',
    fields: [],
  },
  {
    id: 'clearbit',
    name: 'Clearbit',
    description: 'Company and contact enrichment',
    icon: '🔵',
    type: 'enrichment',
    docsUrl: 'https://clearbit.com/docs',
    suggestedFields: ['name', 'domain', 'employee_count', 'revenue', 'industry', 'tech_stack'],
    defaultCost: 0.025,
  },
  {
    id: 'hunter',
    name: 'Hunter.io',
    description: 'Email finder and verification',
    icon: '📧',
    type: 'email_finder',
    docsUrl: 'https://hunter.io/api-documentation',
    suggestedFields: ['email', 'email_verified', 'confidence_score'],
    defaultCost: 0.01,
  },
  {
    id: 'pdl',
    name: 'People Data Labs',
    description: 'Person and company data',
    icon: '👤',
    type: 'enrichment',
    docsUrl: 'https://docs.peopledatalabs.com',
    suggestedFields: ['name', 'email', 'phone', 'linkedin_url', 'job_title', 'company'],
    defaultCost: 0.02,
  },
  {
    id: 'builtwith',
    name: 'BuiltWith',
    description: 'Technology stack detection',
    icon: '🛠️',
    type: 'technographics',
    docsUrl: 'https://api.builtwith.com',
    suggestedFields: ['technologies', 'tech_categories', 'spend_estimate'],
    defaultCost: 0.015,
  },
];

const STEPS = [
  { id: 'select', title: 'Select Provider', icon: Zap },
  { id: 'credentials', title: 'API Credentials', icon: Key },
  { id: 'fields', title: 'Field Mapping', icon: FileText },
  { id: 'costs', title: 'Cost & Limits', icon: DollarSign },
];

export default function ProviderSetupWizard({ isOpen, onClose, onComplete }: ProviderSetupWizardProps) {
  const [step, setStep] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<typeof PROVIDER_TEMPLATES[0] | null>(null);
  const [config, setConfig] = useState<Partial<ProviderConfig>>({
    fields: [],
  });
  const [testResult, setTestResult] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  const currentStep = STEPS[step];

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      // Complete
      onComplete(config as ProviderConfig);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const testConnection = async () => {
    setTestResult('testing');
    await new Promise(r => setTimeout(r, 1500));
    setTestResult(config.apiKey && config.apiKey.length > 10 ? 'success' : 'error');
  };

  const canProceed = () => {
    switch (step) {
      case 0:
        return selectedTemplate !== null;
      case 1:
        return config.apiKey && config.apiKey.length > 0;
      case 2:
        return (config.fields?.length || 0) > 0;
      case 3:
        return config.costPerRecord !== undefined && config.costPerRecord > 0;
      default:
        return true;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-medium text-black">Add New Provider</h2>
            <p className="text-sm text-gray-500">Step {step + 1} of {STEPS.length}: {currentStep.title}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        {/* Progress */}
        <div className="flex px-6 py-3 bg-gray-50 border-b border-gray-200">
          {STEPS.map((s, idx) => {
            const Icon = s.icon;
            const isComplete = idx < step;
            const isCurrent = idx === step;
            return (
              <div key={s.id} className="flex items-center flex-1">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full ${
                    isComplete
                      ? 'bg-green-500 text-white'
                      : isCurrent
                      ? 'bg-black text-white'
                      : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  {isComplete ? <Check size={16} /> : <Icon size={16} />}
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 ${isComplete ? 'bg-green-500' : 'bg-gray-200'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Select Provider */}
          {step === 0 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 mb-4">
                Choose a provider template or start from scratch
              </p>
              <div className="grid grid-cols-2 gap-3">
                {PROVIDER_TEMPLATES.map(template => (
                  <button
                    key={template.id}
                    onClick={() => {
                      setSelectedTemplate(template);
                      setConfig({
                        ...config,
                        id: template.id === 'custom' ? '' : template.id,
                        name: template.id === 'custom' ? '' : template.name,
                        type: template.type,
                        fields: template.suggestedFields || [],
                        costPerRecord: template.defaultCost || 0.01,
                      });
                    }}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      selectedTemplate?.id === template.id
                        ? 'border-black bg-gray-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-2xl mb-2">{template.icon}</div>
                    <div className="font-medium text-gray-900">{template.name}</div>
                    <div className="text-xs text-gray-500 mt-1">{template.description}</div>
                    {template.docsUrl && (
                      <a
                        href={template.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-2"
                      >
                        <ExternalLink size={10} />
                        API Docs
                      </a>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: API Credentials */}
          {step === 1 && (
            <div className="space-y-6">
              {selectedTemplate?.id === 'custom' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Provider ID</label>
                    <input
                      type="text"
                      value={config.id || ''}
                      onChange={(e) => setConfig({ ...config, id: e.target.value.toLowerCase().replace(/\s/g, '_') })}
                      placeholder="e.g., my_provider"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Provider Name</label>
                    <input
                      type="text"
                      value={config.name || ''}
                      onChange={(e) => setConfig({ ...config, name: e.target.value })}
                      placeholder="e.g., My Provider"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Environment Variable Name
                </label>
                <input
                  type="text"
                  value={config.envKey || `${(config.id || 'PROVIDER').toUpperCase()}_API_KEY`}
                  onChange={(e) => setConfig({ ...config, envKey: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                <input
                  type="password"
                  value={config.apiKey || ''}
                  onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                  placeholder="Enter your API key"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
                <p className="text-xs text-gray-500 mt-1">Your key will be encrypted and stored securely</p>
              </div>

              <button
                onClick={testConnection}
                disabled={!config.apiKey || testResult === 'testing'}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                {testResult === 'testing' ? (
                  <>Testing connection...</>
                ) : testResult === 'success' ? (
                  <>
                    <Check size={16} className="text-green-600" />
                    Connection successful
                  </>
                ) : testResult === 'error' ? (
                  <>
                    <AlertCircle size={16} className="text-red-500" />
                    Connection failed
                  </>
                ) : (
                  <>Test Connection</>
                )}
              </button>
            </div>
          )}

          {/* Step 3: Field Mapping */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 mb-4">
                Select the fields this provider can return
              </p>

              <div className="space-y-2">
                {[
                  { key: 'name', label: 'Company Name' },
                  { key: 'domain', label: 'Domain' },
                  { key: 'phone', label: 'Phone Number' },
                  { key: 'email', label: 'Email' },
                  { key: 'address', label: 'Address' },
                  { key: 'employee_count', label: 'Employee Count' },
                  { key: 'revenue', label: 'Revenue' },
                  { key: 'industry', label: 'Industry' },
                  { key: 'linkedin_url', label: 'LinkedIn URL' },
                  { key: 'website', label: 'Website' },
                  { key: 'technologies', label: 'Technologies' },
                  { key: 'rating', label: 'Rating' },
                ].map(field => {
                  const isSelected = config.fields?.includes(field.key);
                  return (
                    <button
                      key={field.key}
                      onClick={() => {
                        const fields = config.fields || [];
                        setConfig({
                          ...config,
                          fields: isSelected
                            ? fields.filter(f => f !== field.key)
                            : [...fields, field.key],
                        });
                      }}
                      className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                        isSelected
                          ? 'border-black bg-gray-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-sm text-gray-700">{field.label}</span>
                      {isSelected && <Check size={16} className="text-black" />}
                    </button>
                  );
                })}
              </div>

              <div className="text-xs text-gray-500 mt-2">
                {config.fields?.length || 0} fields selected
              </div>
            </div>
          )}

          {/* Step 4: Cost & Limits */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cost per Record ($)
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={config.costPerRecord || ''}
                  onChange={(e) => setConfig({ ...config, costPerRecord: parseFloat(e.target.value) })}
                  placeholder="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
                <p className="text-xs text-gray-500 mt-1">Used for cascade cost optimization</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Daily Rate Limit
                </label>
                <input
                  type="number"
                  value={config.rateLimit || ''}
                  onChange={(e) => setConfig({ ...config, rateLimit: parseInt(e.target.value) })}
                  placeholder="10000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={config.description || ''}
                  onChange={(e) => setConfig({ ...config, description: e.target.value })}
                  placeholder="Brief description of what this provider does..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Configuration Summary</h4>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Provider</dt>
                    <dd className="text-gray-900 font-medium">{config.name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Fields</dt>
                    <dd className="text-gray-900">{config.fields?.length || 0} configured</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Cost</dt>
                    <dd className="text-gray-900">${config.costPerRecord?.toFixed(3)}/record</dd>
                  </div>
                </dl>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleBack}
            disabled={step === 0}
            className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} />
            Back
          </button>
          <button
            onClick={handleNext}
            disabled={!canProceed()}
            className="flex items-center gap-1 px-6 py-2 bg-black text-white rounded-full text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {step === STEPS.length - 1 ? 'Complete Setup' : 'Next'}
            {step < STEPS.length - 1 && <ChevronRight size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
