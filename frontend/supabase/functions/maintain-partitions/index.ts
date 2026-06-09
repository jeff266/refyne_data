/**
 * Supabase Edge Function: maintain-partitions
 *
 * Automatically maintains weekly partitions for the org_usage table.
 * Runs weekly on Mondays at 1am UTC via cron schedule.
 *
 * Schedule: "0 1 * * 1"
 *
 * Logic:
 * 1. Discovers existing partitions
 * 2. Creates partitions for next 12 weeks
 * 3. Drops partitions older than 26 weeks (6 months)
 * 4. Sends alerts on failures
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface PartitionInfo {
  tablename: string;
  year: number;
  week: number;
}

interface MaintenanceResult {
  success: boolean;
  created: number;
  dropped: number;
  currentRange: string;
  errors: string[];
}

/**
 * Parse partition table name to extract year and week
 * Example: 'org_usage_2026_34' -> { year: 2026, week: 34 }
 */
function parsePartitionName(tablename: string): PartitionInfo | null {
  const match = tablename.match(/^org_usage_(\d{4})_(\d{2})$/);
  if (!match) return null;

  return {
    tablename,
    year: parseInt(match[1], 10),
    week: parseInt(match[2], 10),
  };
}

/**
 * Get ISO week number for a date
 */
function getISOWeek(date: Date): { year: number; week: number } {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);

  return {
    year: target.getFullYear(),
    week: weekNumber,
  };
}

/**
 * Get start date for a given ISO week
 */
function getWeekStartDate(year: number, week: number): Date {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const isoWeekStart = simple;
  if (dow <= 4) {
    isoWeekStart.setDate(simple.getDate() - simple.getDay() + 1);
  } else {
    isoWeekStart.setDate(simple.getDate() + 8 - simple.getDay());
  }
  return isoWeekStart;
}

/**
 * Format date as YYYY-MM-DD for SQL
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Send alert email via Resend
 */
async function sendAlertEmail(subject: string, body: string) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    console.error('[Alert] RESEND_API_KEY not configured, skipping email alert');
    return;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'alerts@refynedata.com',
        to: ['engineering@refynedata.com'],
        subject: `[Partition Maintenance] ${subject}`,
        html: `
          <h2>${subject}</h2>
          <pre>${body}</pre>
          <p><small>Sent from maintain-partitions edge function</small></p>
        `,
      }),
    });

    if (!response.ok) {
      console.error('[Alert] Failed to send email:', await response.text());
    }
  } catch (error) {
    console.error('[Alert] Error sending email:', error);
  }
}

/**
 * Main partition maintenance function
 */
async function maintainPartitions(supabase: any): Promise<MaintenanceResult> {
  const result: MaintenanceResult = {
    success: true,
    created: 0,
    dropped: 0,
    currentRange: '',
    errors: [],
  };

  try {
    // 1. Get existing partitions using helper function
    const { data: existingPartitions, error: listError } = await supabase.rpc('list_org_usage_partitions');

    if (listError) {
      throw new Error(`Failed to list partitions: ${listError.message}`);
    }

    console.log(`[Maintenance] Found ${existingPartitions?.length || 0} existing partitions`);

    // Parse existing partition info
    const partitions: PartitionInfo[] = (existingPartitions || [])
      .map((row: any) => parsePartitionName(row.tablename))
      .filter((p: PartitionInfo | null) => p !== null) as PartitionInfo[];

    // 2. Determine current week and target range
    const now = new Date();
    const currentWeek = getISOWeek(now);

    // Find latest existing partition
    let latestPartition = partitions[0]; // Already sorted DESC

    console.log(`[Maintenance] Current week: ${currentWeek.year}_${String(currentWeek.week).padStart(2, '0')}`);
    console.log(`[Maintenance] Latest partition: ${latestPartition?.tablename || 'none'}`);

    // 3. Create partitions for next 12 weeks
    const weeksToCreate: { year: number; week: number }[] = [];

    for (let i = 0; i < 12; i++) {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + (i * 7));
      const targetWeek = getISOWeek(targetDate);

      // Check if partition already exists
      const exists = partitions.some(
        p => p.year === targetWeek.year && p.week === targetWeek.week
      );

      if (!exists) {
        weeksToCreate.push(targetWeek);
      }
    }

    console.log(`[Maintenance] Need to create ${weeksToCreate.length} partitions`);

    // Create missing partitions
    for (const week of weeksToCreate) {
      try {
        const weekStr = String(week.week).padStart(2, '0');
        const tableName = `org_usage_${week.year}_${weekStr}`;

        const startDate = getWeekStartDate(week.year, week.week);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 7);

        console.log(`[Maintenance] Creating partition: ${tableName}`);

        const { data: created, error: createError } = await supabase.rpc('create_org_usage_partition', {
          p_table_name: tableName,
          p_start_date: formatDate(startDate),
          p_end_date: formatDate(endDate),
        });

        if (createError || !created) {
          throw new Error(`Failed to create ${tableName}: ${createError?.message || 'Unknown error'}`);
        }

        result.created++;
      } catch (error: any) {
        const errorMsg = `Failed to create partition for ${week.year}_${String(week.week).padStart(2, '0')}: ${error.message}`;
        console.error(`[Maintenance] ${errorMsg}`);
        result.errors.push(errorMsg);
        result.success = false;
      }
    }

    // 4. Drop partitions older than 26 weeks (6 months)
    const cutoffDate = new Date(now);
    cutoffDate.setDate(cutoffDate.getDate() - (26 * 7));
    const cutoffWeek = getISOWeek(cutoffDate);

    console.log(`[Maintenance] Cutoff week: ${cutoffWeek.year}_${String(cutoffWeek.week).padStart(2, '0')}`);

    const partitionsToDrop = partitions.filter(p => {
      if (p.year < cutoffWeek.year) return true;
      if (p.year === cutoffWeek.year && p.week < cutoffWeek.week) return true;
      return false;
    });

    console.log(`[Maintenance] Found ${partitionsToDrop.length} partitions to drop`);

    // Archive data before dropping (if needed)
    for (const partition of partitionsToDrop) {
      try {
        console.log(`[Maintenance] Dropping partition: ${partition.tablename}`);

        // Note: Archive logic removed - org_usage data is already aggregated to org_billing_events
        // by the billing pipeline. Dropping partitions only removes raw usage data.

        // Drop the partition using helper function
        const { data: dropped, error: dropError } = await supabase.rpc('drop_org_usage_partition', {
          p_table_name: partition.tablename,
        });

        if (dropError || !dropped) {
          throw new Error(`Failed to drop ${partition.tablename}: ${dropError?.message || 'Unknown error'}`);
        }

        result.dropped++;
      } catch (error: any) {
        const errorMsg = `Failed to drop partition ${partition.tablename}: ${error.message}`;
        console.error(`[Maintenance] ${errorMsg}`);
        result.errors.push(errorMsg);
        // Don't mark as failure - dropping old partitions is not critical
      }
    }

    // 5. Determine current range
    const { data: rangeData } = await supabase.rpc('get_org_usage_partition_range');

    if (rangeData && rangeData.length > 0) {
      const { min_partition, max_partition } = rangeData[0];
      if (min_partition && max_partition) {
        const minParsed = parsePartitionName(min_partition);
        const maxParsed = parsePartitionName(max_partition);
        if (minParsed && maxParsed) {
          result.currentRange = `${minParsed.year}_${String(minParsed.week).padStart(2, '0')} to ${maxParsed.year}_${String(maxParsed.week).padStart(2, '0')}`;
        }
      }
    }

    console.log(`[Maintenance] Complete - Created: ${result.created}, Dropped: ${result.dropped}, Range: ${result.currentRange}`);

    // Send alert if there were errors
    if (result.errors.length > 0) {
      await sendAlertEmail(
        'Partition Maintenance Completed with Errors',
        `Created: ${result.created}\nDropped: ${result.dropped}\nCurrent Range: ${result.currentRange}\n\nErrors:\n${result.errors.join('\n')}`
      );
    }

    return result;
  } catch (error: any) {
    console.error('[Maintenance] Fatal error:', error);
    result.success = false;
    result.errors.push(`Fatal error: ${error.message}`);

    // Send critical alert
    await sendAlertEmail(
      'Partition Maintenance FAILED',
      `Fatal error occurred:\n\n${error.message}\n\nStack trace:\n${error.stack}`
    );

    return result;
  }
}

/**
 * Edge function handler
 */
serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    // Get service role key from environment (automatically provided by Supabase)
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';

    // Verify authorization - accept requests with service role key
    const authHeader = req.headers.get('authorization');

    // For manual invocation: require Bearer token
    // For cron invocation: authorization header will be empty (cron jobs run internally)
    if (authHeader && !authHeader.includes('Bearer')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - invalid authorization format' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role
    const supabase = createClient(supabaseUrl, serviceRoleKey || '', {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.log('[Maintenance] Starting partition maintenance...');
    const result = await maintainPartitions(supabase);

    return new Response(
      JSON.stringify(result),
      {
        status: result.success ? 200 : 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error: any) {
    console.error('[Edge Function] Unhandled error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});
