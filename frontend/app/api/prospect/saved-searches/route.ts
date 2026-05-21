/**
 * Saved Searches API
 *
 * GET  /api/prospect/saved-searches - List saved searches
 * POST /api/prospect/saved-searches - Create new saved search
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';

export async function GET(req: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    // Get all saved searches for this org and user
    const { data: searches, error } = await supabase
      .from('prospect_saved_searches')
      .select('*')
      .eq('org_id', ctx.orgId)
      .or(`scope.eq.workspace,created_by.eq.${ctx.userId}`)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: searches || [],
    });
  } catch (error) {
    console.error('[Saved Searches] GET error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch saved searches',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const body = await req.json();
    const { name, filters, scope = 'personal' } = body;

    // Validate
    if (!name || !filters) {
      return NextResponse.json(
        { error: 'Name and filters are required' },
        { status: 400 }
      );
    }

    // Create saved search
    const { data: search, error } = await supabase
      .from('prospect_saved_searches')
      .insert({
        org_id: ctx.orgId,
        created_by: ctx.userId,
        name,
        filters,
        scope,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: search,
    });
  } catch (error) {
    console.error('[Saved Searches] POST error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create saved search',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
