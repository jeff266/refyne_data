'use client';

import { ChevronRight, AlertCircle, RefreshCw, FileQuestion, FileCheck, Settings2 } from 'lucide-react';
import type { CascadeTrigger } from '@/types';
import ProviderLogo from '@/components/ProviderLogo';

interface Provider {
  name: string;
  type: string;
  env_key?: string;
  env_keys?: string[];
}

interface CascadeStep {
  providerId: string;
  trigger: CascadeTrigger;
  triggerConfig?: Record<string, any>;
}

interface CascadePreviewProps {
  cascade: string[] | CascadeStep[];
  providers: Record<string, Provider>;
  fallbackEnabled?: boolean;
  onEdit?: () => void;
  compact?: boolean;
}

// Color coding for trigger types
const getTriggerStyle = (trigger: CascadeTrigger): { bg: string; text: string; border: string } => {
  const styles: Record<CascadeTrigger, { bg: string; text: string; border: string }> = {
    always: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200' },
    on_error: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
    on_empty: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    on_missing_field: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    on_field_present: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    on_condition: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  };
  return styles[trigger] || styles.always;
};

const getTriggerLabel = (trigger: CascadeTrigger): string => {
  const labels: Record<CascadeTrigger, string> = {
    always: 'always',
    on_error: 'on error',
    on_empty: 'if empty',
    on_missing_field: 'if missing field',
    on_field_present: 'if field present',
    on_condition: 'on condition',
  };
  return labels[trigger] || trigger;
};

const getTriggerIcon = (trigger: CascadeTrigger) => {
  const icons: Record<CascadeTrigger, React.ReactNode> = {
    always: <ChevronRight className="w-3 h-3" />,
    on_error: <AlertCircle className="w-3 h-3" />,
    on_empty: <FileQuestion className="w-3 h-3" />,
    on_missing_field: <FileQuestion className="w-3 h-3" />,
    on_field_present: <FileCheck className="w-3 h-3" />,
    on_condition: <Settings2 className="w-3 h-3" />,
  };
  return icons[trigger] || icons.always;
};

// Normalize cascade to CascadeStep format
const normalizeCascade = (cascade: string[] | CascadeStep[]): CascadeStep[] => {
  if (cascade.length === 0) return [];

  // Check if it's already in CascadeStep format
  if (typeof cascade[0] === 'object' && 'providerId' in cascade[0]) {
    return cascade as CascadeStep[];
  }

  // Convert string[] to CascadeStep[]
  return (cascade as string[]).map((providerId, index) => ({
    providerId,
    trigger: index === 0 ? 'always' : 'on_error',
  }));
};

export default function CascadePreview({
  cascade,
  providers,
  fallbackEnabled = true,
  onEdit,
  compact = false,
}: CascadePreviewProps) {
  const normalizedCascade = normalizeCascade(cascade);

  if (normalizedCascade.length === 0) {
    return (
      <div
        className={`text-sm text-gray-400 ${onEdit ? 'cursor-pointer hover:text-gray-600' : ''}`}
        onClick={onEdit}
      >
        No providers configured
      </div>
    );
  }

  if (compact) {
    return (
      <div
        className={`flex items-center gap-1.5 flex-wrap ${onEdit ? 'cursor-pointer group' : ''}`}
        onClick={onEdit}
      >
        {normalizedCascade.map((step, index) => {
          const provider = providers[step.providerId];
          if (!provider) return null;

          const style = getTriggerStyle(step.trigger);
          const isFirst = index === 0;

          return (
            <div key={step.providerId} className="flex items-center gap-1.5">
              {!isFirst && (
                <span className={`text-[10px] ${style.text} flex items-center gap-0.5`}>
                  {getTriggerIcon(step.trigger)}
                </span>
              )}
              <span className={`text-xs font-medium ${isFirst ? 'text-black' : 'text-gray-600'} flex items-center gap-1.5`}>
                <ProviderLogo providerId={step.providerId} size={14} />
                {provider.name}
              </span>
            </div>
          );
        })}
        {onEdit && (
          <span className="text-gray-400 group-hover:text-gray-600 ml-1 transition-colors">
            <Settings2 className="w-3.5 h-3.5" />
          </span>
        )}
      </div>
    );
  }

  // Full preview with detailed trigger info
  return (
    <div
      className={`space-y-2 ${onEdit ? 'cursor-pointer' : ''}`}
      onClick={onEdit}
    >
      {normalizedCascade.map((step, index) => {
        const provider = providers[step.providerId];
        if (!provider) return null;

        const style = getTriggerStyle(step.trigger);
        const isFirst = index === 0;

        return (
          <div key={step.providerId} className="flex items-start gap-2">
            {/* Provider logo */}
            <div className="flex-shrink-0">
              <ProviderLogo providerId={step.providerId} size={20} />
            </div>

            {/* Provider info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm text-black">{provider.name}</span>
                {!isFirst && (
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded ${style.bg} ${style.text} border ${style.border}`}>
                    {getTriggerIcon(step.trigger)}
                    {getTriggerLabel(step.trigger)}
                  </span>
                )}
              </div>
              {step.triggerConfig && Object.keys(step.triggerConfig).length > 0 && (
                <div className="text-[10px] text-gray-400 mt-0.5">
                  {step.trigger === 'on_missing_field' && step.triggerConfig.field && (
                    <span>field: {step.triggerConfig.field}</span>
                  )}
                  {step.trigger === 'on_field_present' && step.triggerConfig.field && (
                    <span>field: {step.triggerConfig.field}</span>
                  )}
                </div>
              )}
            </div>

            {/* Connection line */}
            {index < normalizedCascade.length - 1 && (
              <div className="absolute left-2.5 top-5 w-px h-4 bg-gray-200" />
            )}
          </div>
        );
      })}

      {onEdit && (
        <button className="mt-2 text-xs text-gray-500 hover:text-black transition-colors flex items-center gap-1">
          <Settings2 className="w-3 h-3" />
          Edit cascade
        </button>
      )}
    </div>
  );
}
