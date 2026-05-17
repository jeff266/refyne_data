'use client';

import Link from 'next/link';
import {
  Building2,
  Store,
  Search,
  Briefcase,
  ArrowRight,
  Filter,
  Database,
  Check,
  AlertCircle,
} from 'lucide-react';
import ProviderStack from './ProviderStack';

interface InputField {
  id: string;
  type: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  source?: string;
}

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
  input_fields: InputField[];
}

interface Provider {
  name: string;
  type: string;
  env_key?: string;
  env_keys?: string[];
}

interface SegmentDetailCardProps {
  segment: Segment;
  providers: Record<string, Provider>;
}

// Icon mapping for segment types
const iconMap: Record<string, React.ReactNode> = {
  storefront: <Store className="w-6 h-6" />,
  business: <Briefcase className="w-6 h-6" />,
  corporate_fare: <Building2 className="w-6 h-6" />,
  search: <Search className="w-6 h-6" />,
};

// Simulated connection status - in production this would come from API
const getConnectionStatus = (providerId: string): boolean => {
  const connectedProviders = ['serper', 'apollo', 'clay'];
  return connectedProviders.includes(providerId);
};

export default function SegmentDetailCard({ segment, providers }: SegmentDetailCardProps) {
  const primaryProviderId = segment.providers.cascade[0];
  const primaryProvider = primaryProviderId ? providers[primaryProviderId] : null;
  const isPrimaryConnected = primaryProviderId ? getConnectionStatus(primaryProviderId) : false;

  // Count required vs optional fields
  const requiredFields = segment.input_fields.filter((f) => f.required);
  const optionalFields = segment.input_fields.filter((f) => !f.required);

  return (
    <Link href={`/search/${segment.id}`}>
      <div className="card-hover p-6 group h-full flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className="w-12 h-12 bg-mplc-gray-100 rounded-xl flex items-center justify-center text-mplc-gray-600 group-hover:bg-mplc-black group-hover:text-mplc-white transition-colors">
              {iconMap[segment.icon] || <Database className="w-6 h-6" />}
            </div>

            {/* Title & Description */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg text-mplc-black group-hover:underline">
                {segment.display_name}
              </h3>
              <p className="text-sm text-mplc-gray-500 mt-1 line-clamp-2">
                {segment.description}
              </p>
            </div>
          </div>

          {/* Visibility Badge */}
          {!segment.visible && (
            <span className="badge-warning text-[10px] flex-shrink-0">Hidden</span>
          )}
        </div>

        {/* Provider Stack */}
        <div className="bg-mplc-gray-50 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-mplc-gray-500 font-medium uppercase tracking-wider">
              Provider Stack
            </p>
            {isPrimaryConnected ? (
              <div className="flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-green-600" />
                <span className="text-[10px] text-green-600 font-medium">Ready</span>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-[10px] text-amber-500 font-medium">Setup Required</span>
              </div>
            )}
          </div>
          <ProviderStack
            cascade={segment.providers.cascade}
            fallback={segment.providers.fallback}
            fallbackEnabled={segment.providers.fallback_enabled}
            providers={providers}
            compact
          />
        </div>

        {/* Input Fields / Filters */}
        <div className="mb-4 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Filter className="w-3.5 h-3.5 text-mplc-gray-400" />
            <p className="text-xs text-mplc-gray-500 font-medium uppercase tracking-wider">
              Search Filters
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {segment.input_fields.slice(0, 4).map((field) => (
              <span
                key={field.id}
                className={`px-2 py-1 text-xs rounded ${
                  field.required
                    ? 'bg-mplc-gray-800 text-mplc-white'
                    : 'bg-mplc-gray-100 text-mplc-gray-600'
                }`}
              >
                {field.label}
                {field.required && <span className="text-mplc-gray-400 ml-0.5">*</span>}
              </span>
            ))}
            {segment.input_fields.length > 4 && (
              <span className="px-2 py-1 text-xs text-mplc-gray-400">
                +{segment.input_fields.length - 4} more
              </span>
            )}
          </div>
          {segment.input_fields.length === 0 && (
            <p className="text-xs text-mplc-gray-400">No input fields configured</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-mplc-gray-100">
          <div className="text-xs text-mplc-gray-400">
            {requiredFields.length > 0 && (
              <span>{requiredFields.length} required field{requiredFields.length !== 1 ? 's' : ''}</span>
            )}
            {requiredFields.length > 0 && optionalFields.length > 0 && (
              <span className="mx-1">&bull;</span>
            )}
            {optionalFields.length > 0 && (
              <span>{optionalFields.length} optional</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm font-medium text-mplc-black group-hover:text-mplc-gray-600">
            <span>Start Search</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>
    </Link>
  );
}
