import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { getAccessToken } from '@/lib/hubspot/get-access-token';
import { getRedisConnection } from '@/lib/queue/redis';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

interface FieldFillRate {
  name: string;
  label: string;
  filled: number;
  total: number;
  rate: number;
}

// Hardcoded field lists as specified
const COMPANY_FIELDS = [
  { name: 'industry', label: 'Industry' },
  { name: 'numberofemployees', label: 'Number of employees' },
  { name: 'phone', label: 'Phone' },
  { name: 'linkedin_company_page', label: 'LinkedIn company page' },
  { name: 'annualrevenue', label: 'Annual revenue' },
  { name: 'website', label: 'Website' },
];

const CONTACT_FIELDS = [
  { name: 'email', label: 'Email' },
  { name: 'phone', label: 'Phone' },
  { name: 'jobtitle', label: 'Job title' },
  { name: 'company', label: 'Company' },
  { name: 'linkedin_url', label: 'LinkedIn URL' },
  { name: 'city', label: 'City' },
];

/**
 * GET /api/dashboard/fill-rates
 *
 * Query params:
 * - objectType: 'company' | 'contact'
 *
 * Returns fill rates for hardcoded field lists.
 * Fetches from HubSpot API using getAccessToken().
 *
 * Redis cache: 1 hour TTL
 * Cache key: dashboard:fill-rates:${orgId}:${objectType}
 */
export async function GET(request: NextRequest) {
  // Auth check
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  const { orgId } = ctx;
  const { searchParams } = new URL(request.url);
  const objectType = searchParams.get('objectType') || 'company';

  if (objectType !== 'company' && objectType !== 'contact') {
    return NextResponse.json(
      { error: 'Invalid objectType. Must be "company" or "contact"' },
      { status: 400 }
    );
  }

  try {
    // Check Redis cache first
    const redis = getRedisConnection();
    const cacheKey = `dashboard:fill-rates:${orgId}:${objectType}`;

    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return NextResponse.json(JSON.parse(cached));
        }
      } catch (err) {
        console.warn('[dashboard/fill-rates] Redis get failed:', err);
      }
    }

    // Get HubSpot access token
    const accessToken = await getAccessToken(orgId);
    if (!accessToken) {
      console.warn('[dashboard/fill-rates] No HubSpot access token found');
      return NextResponse.json({ fillRates: [] });
    }

    // Select field list based on objectType
    const fields = objectType === 'company' ? COMPANY_FIELDS : CONTACT_FIELDS;
    const fieldNames = fields.map((f) => f.name);

    // Fetch records from HubSpot with requested properties
    const hubspotObjectType = objectType === 'company' ? 'companies' : 'contacts';
    const url = `https://api.hubapi.com/crm/v3/objects/${hubspotObjectType}?properties=${fieldNames.join(',')}&limit=100`;

    console.log(`[dashboard/fill-rates] Fetching ${objectType} records with fields:`, fieldNames.join(','));

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[dashboard/fill-rates] HubSpot API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        objectType,
        fields: fieldNames,
      });

      // Return empty rates instead of throwing to prevent dashboard from breaking
      return NextResponse.json({ fillRates: [] });
    }

    const data = await response.json();
    const records = data.results || [];
    const total = records.length;

    // Calculate fill rates for each field
    const fillRates: FieldFillRate[] = fields.map((field) => {
      const filled = records.filter((record: any) => {
        const value = record.properties[field.name];
        return value !== null && value !== undefined && value !== '';
      }).length;

      return {
        name: field.name,
        label: field.label,
        filled,
        total,
        rate: total > 0 ? Math.round((filled / total) * 100) : 0,
      };
    });

    const result = { fillRates };

    // Cache for 1 hour
    if (redis) {
      try {
        await redis.set(cacheKey, JSON.stringify(result), 'EX', 60 * 60);
      } catch (err) {
        console.warn('[dashboard/fill-rates] Redis set failed:', err);
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, {
      route: '/api/dashboard/fill-rates',
      objectType,
    });
    console.error('Failed to get fill rates:', error);
    return NextResponse.json(
      { error: 'Failed to get fill rates' },
      { status: 500 }
    );
  }
}
