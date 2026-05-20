import { NextRequest, NextResponse } from 'next/server';
import { requireOperatorOrAbove, authError } from '@/lib/auth/clerk-helpers';
import { supabase } from '@/lib/db/supabase';
import { clearLookupCache } from '@/lib/harmonies/normalization-engine';

/**
 * POST /api/harmonies/:id/output-format
 *
 * Updates the output format setting for a harmony (org-specific for library harmonies).
 * Auth: org:operator or above
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let ctx;
  try {
    ctx = await requireOperatorOrAbove();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const { outputFormat } = body;

    if (!outputFormat || typeof outputFormat !== 'string') {
      return NextResponse.json({ error: 'Invalid output format' }, { status: 400 });
    }

    // Check if harmony exists and get its settings
    const { data: harmony, error: fetchError } = await supabase
      .from('harmonies')
      .select('id, is_preset, org_id, output_formats_available')
      .eq('id', params.id)
      .single();

    if (fetchError || !harmony) {
      return NextResponse.json({ error: 'Harmony not found' }, { status: 404 });
    }

    // Validate output format is available for this harmony
    if (harmony.output_formats_available) {
      const availableKeys = harmony.output_formats_available.map((f: any) => f.key);
      if (!availableKeys.includes(outputFormat) && outputFormat !== 'default') {
        return NextResponse.json(
          { error: `Invalid output format. Available: ${availableKeys.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // For preset harmonies, update/create org settings
    if (harmony.is_preset || harmony.org_id === null) {
      const { error: upsertError } = await supabase
        .from('harmony_org_settings')
        .upsert({
          org_id: ctx.orgId,
          harmony_id: params.id,
          output_format: outputFormat,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'org_id,harmony_id',
        });

      if (upsertError) {
        console.error('Failed to update harmony org settings:', upsertError);
        return NextResponse.json({ error: 'Failed to update format' }, { status: 500 });
      }
    } else {
      // For custom harmonies, update directly
      const { error: updateError } = await supabase
        .from('harmonies')
        .update({
          output_format: outputFormat,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.id)
        .eq('org_id', ctx.orgId);

      if (updateError) {
        console.error('Failed to update harmony:', updateError);
        return NextResponse.json({ error: 'Failed to update format' }, { status: 500 });
      }
    }

    // Invalidate lookup cache for this harmony
    await clearLookupCache(ctx.orgId, params.id);

    return NextResponse.json({ success: true, outputFormat });
  } catch (error) {
    console.error('Failed to update output format:', error);
    return NextResponse.json({ error: 'Failed to update format' }, { status: 500 });
  }
}
