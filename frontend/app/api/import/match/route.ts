import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireAdmin } from '@/lib/auth/roles';
import { isBetaFeatureEnabled } from '@/lib/features/flags';
import { FEATURE_FLAGS } from '@/lib/features/flags';
import { supabaseAdmin } from '@/lib/db/admin-client';
import { getAccessToken } from '@/lib/hubspot/get-access-token';
import { HubSpotClient } from '@/lib/hubspot/client';
import { matchContact, type ParsedRow, type Bucket } from '@/lib/import/matcher';
import { cleanLastName, splitFullName, extractEmailDomain } from '@/lib/import/name-cleaner';
import { classifyJobTitleLevel } from '@/lib/import/client-job-classifier';
import { z } from 'zod';

const matchRequestSchema = z.object({
  session_id: z.string().uuid(),
  field_mapping: z.object({
    email: z.string().min(1),
    linkedin_url: z.string().optional(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    full_name: z.string().optional(),
    job_title: z.string().optional(),
    company: z.string().optional(),
    location: z.string().optional(),
  }),
  filters: z.record(z.string(), z.unknown()).optional(),
});

interface FilterConfig {
  [column: string]: any; // Filter configuration per column
}

interface FieldMapping {
  email: string;
  linkedin_url?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  job_title?: string;
  company?: string;
  location?: string;
}

/**
 * POST /api/import/match
 * Run matching engine on import session
 */
export async function POST(request: NextRequest) {
  // Auth
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  requireAdmin(ctx.orgRole);

  // Beta gate
  const betaEnabled = await isBetaFeatureEnabled(ctx.orgId, FEATURE_FLAGS.EVENT_LIST_IMPORT);
  if (!betaEnabled) {
    return NextResponse.json({ error: 'feature_not_enabled' }, { status: 403 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    // Validate request body
    const rawBody = await request.json();
    const validation = matchRequestSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      );
    }
    const { session_id, field_mapping, filters } = validation.data;

    // Load import session
    const { data: importSession, error: sessionError } = await supabaseAdmin
      .from('event_imports')
      .select('*')
      .eq('id', session_id)
      .eq('org_id', ctx.orgId)
      .single();

    if (sessionError || !importSession) {
      return NextResponse.json({ error: 'Import session not found' }, { status: 404 });
    }

    // Load rows
    const { data: rows, error: rowsError } = await supabaseAdmin
      .from('event_import_rows')
      .select('*')
      .eq('import_id', session_id)
      .order('row_index');

    if (rowsError || !rows) {
      return NextResponse.json({ error: 'Failed to load import rows' }, { status: 500 });
    }

    console.log(`[Import Match] Loaded ${rows.length} rows for session ${session_id}`);

    // Apply filters (if any)
    let workingSet = rows;
    if (filters && Object.keys(filters).length > 0) {
      workingSet = applyFilters(rows, filters, field_mapping);
      console.log(`[Import Match] After filters: ${workingSet.length} rows`);
    }

    // Map and clean contact data
    const parsedContacts: ParsedRow[] = workingSet.map((row) => {
      const rawData = row.raw_data as Record<string, string>;

      // Extract mapped fields
      let firstName = field_mapping.first_name ? rawData[field_mapping.first_name] : undefined;
      let lastName = field_mapping.last_name ? rawData[field_mapping.last_name] : undefined;

      // Handle full name split
      if (field_mapping.full_name && rawData[field_mapping.full_name]) {
        const split = splitFullName(rawData[field_mapping.full_name]);
        if (!firstName) firstName = split.first;
        if (!lastName) lastName = split.last;
      }

      // Clean last name
      if (lastName) {
        lastName = cleanLastName(lastName);
      }

      return {
        email: rawData[field_mapping.email]?.toLowerCase().trim() || '',
        linkedin_url: field_mapping.linkedin_url ? rawData[field_mapping.linkedin_url] : undefined,
        first_name: firstName,
        last_name: lastName,
        job_title: field_mapping.job_title ? rawData[field_mapping.job_title] : undefined,
        company: field_mapping.company ? rawData[field_mapping.company] : undefined,
        location: field_mapping.location ? rawData[field_mapping.location] : undefined,
      };
    });

    // Pre-fetch ALL HubSpot contacts and companies into memory
    console.log('[Import Match] Pre-fetching HubSpot contacts...');
    const accessToken = await getAccessToken(ctx.orgId);
    if (!accessToken) {
      return NextResponse.json({ error: 'HubSpot not connected' }, { status: 400 });
    }

    const hubspotClient = new HubSpotClient(accessToken, ''); // Portal ID not needed for these calls

    // Fetch all contacts (limited properties)
    const allContacts = await fetchAllContacts(hubspotClient);
    console.log(`[Import Match] Fetched ${allContacts.length} HubSpot contacts`);

    // Fetch all companies
    const allCompanies = await fetchAllCompanies(hubspotClient);
    console.log(`[Import Match] Fetched ${allCompanies.length} HubSpot companies`);

    // Run matching in parallel batches of 500
    console.log('[Import Match] Running matching engine...');
    const startTime = Date.now();

    const matchResults = await Promise.all(
      parsedContacts.map((contact) => matchContact(contact, allContacts, allCompanies, ctx.orgId))
    );

    const elapsed = Date.now() - startTime;
    console.log(`[Import Match] Matched ${matchResults.length} contacts in ${elapsed}ms`);

    // Update rows with match results
    console.log('[Import Match] Updating rows with match results...');
    const updatePromises = workingSet.map((row, index) => {
      const result = matchResults[index];
      const parsedContact = parsedContacts[index];

      return supabaseAdmin
        .from('event_import_rows')
        .update({
          bucket: result.bucket,
          match_type: result.matchType,
          match_confidence: result.confidence,
          hubspot_contact_id: result.hubspotContactId,
          hubspot_company_id: result.hubspotCompanyId,
          review_reason: result.reviewReason,
          cleaned_first_name: parsedContact.first_name,
          cleaned_last_name: parsedContact.last_name,
          email_domain: extractEmailDomain(parsedContact.email),
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);
    });

    await Promise.all(updatePromises);

    // Calculate bucket summary
    const summary: Record<Bucket, number> = {
      customer: 0,
      open_deal: 0,
      former_customer: 0,
      known_contact: 0,
      new_contact: 0,
      needs_review: 0,
    };

    for (const result of matchResults) {
      summary[result.bucket]++;
    }

    // Get sample rows per bucket (3 each)
    const sampleRows: Record<Bucket, any[]> = {
      customer: [],
      open_deal: [],
      former_customer: [],
      known_contact: [],
      new_contact: [],
      needs_review: [],
    };

    for (let i = 0; i < workingSet.length && i < matchResults.length; i++) {
      const bucket = matchResults[i].bucket;
      if (sampleRows[bucket].length < 3) {
        sampleRows[bucket].push({
          ...parsedContacts[i],
          match_type: matchResults[i].matchType,
          confidence: matchResults[i].confidence,
          review_reason: matchResults[i].reviewReason,
        });
      }
    }

    // Update import session with match summary
    await supabaseAdmin
      .from('event_imports')
      .update({
        status: 'matched',
        match_summary: summary,
        matched_count: matchResults.length,
        field_mapping,
        filter_config: filters,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session_id);

    return NextResponse.json({
      summary,
      sample_rows: sampleRows,
    });
  } catch (error) {
    console.error('[Import Match] Unexpected error:', error);
    return NextResponse.json({ error: 'Failed to match contacts' }, { status: 500 });
  }
}

/**
 * Apply filters to rows
 */
function applyFilters(rows: any[], filters: FilterConfig, fieldMapping: FieldMapping): any[] {
  // Determine if job_title column exists and what it's mapped to
  const jobTitleColumn = fieldMapping.job_title;

  return rows.filter((row) => {
    const rawData = row.raw_data as Record<string, string>;

    for (const [column, filterConfig] of Object.entries(filters)) {
      const value = rawData[column];

      // Handle different filter types
      if (Array.isArray(filterConfig)) {
        // Multi-select filter

        // Special case: job title level filtering
        if (jobTitleColumn && column === jobTitleColumn) {
          // Classify the job title to a level and check if it matches
          const level = classifyJobTitleLevel(value);
          if (!filterConfig.includes(level)) {
            return false;
          }
        } else {
          // Regular value filtering (company, location, etc.)
          if (!filterConfig.includes(value)) {
            return false;
          }
        }
      } else if (typeof filterConfig === 'object' && filterConfig.contains) {
        // Contains filter
        if (!value || !value.toLowerCase().includes(filterConfig.contains.toLowerCase())) {
          return false;
        }
      } else if (typeof filterConfig === 'object' && filterConfig.not_contains) {
        // Does not contain filter
        if (value && value.toLowerCase().includes(filterConfig.not_contains.toLowerCase())) {
          return false;
        }
      }
    }

    return true;
  });
}

/**
 * Fetch all HubSpot contacts with pagination
 */
async function fetchAllContacts(client: HubSpotClient): Promise<any[]> {
  const properties = [
    'email',
    'firstname',
    'lastname',
    'linkedin_url',
    'lifecyclestage',
    'hs_lead_status',
    'jobtitle',
  ];

  const allContacts: any[] = [];
  let after: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const response = await client.request<{
      results: any[];
      paging?: { next?: { after: string } };
    }>('/crm/v3/objects/contacts/search', {
      method: 'POST',
      body: JSON.stringify({
        properties,
        limit: 200, // HubSpot max limit per request
        after,
      }),
    });

    allContacts.push(...(response.results || []));
    after = response.paging?.next?.after;
    hasMore = !!after;

    // Safety limit: stop at 50,000 contacts
    if (allContacts.length >= 50000) {
      console.warn('[Import Match] Reached 50k contact limit, stopping fetch');
      break;
    }
  }

  return allContacts;
}

/**
 * Fetch all HubSpot companies with pagination
 */
async function fetchAllCompanies(client: HubSpotClient): Promise<any[]> {
  const properties = ['name', 'domain'];

  const allCompanies: any[] = [];
  let after: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const response = await client.request<{
      results: any[];
      paging?: { next?: { after: string } };
    }>('/crm/v3/objects/companies/search', {
      method: 'POST',
      body: JSON.stringify({
        properties,
        limit: 200, // HubSpot max limit per request
        after,
      }),
    });

    allCompanies.push(...(response.results || []));
    after = response.paging?.next?.after;
    hasMore = !!after;

    // Safety limit: stop at 50,000 companies
    if (allCompanies.length >= 50000) {
      console.warn('[Import Match] Reached 50k company limit, stopping fetch');
      break;
    }
  }

  return allCompanies;
}
