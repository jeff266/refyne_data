import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { clerkClient } from '@clerk/nextjs/server';

/**
 * GET /api/blog/media/giphy
 * Proxy Giphy API for GIF search (staff only)
 */
export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  // Check if user is Refyne staff
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(ctx.userId);
    const isStaff = user.publicMetadata?.isRefyneStaff === true;

    if (!isStaff) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } catch (error) {
    console.error('[Giphy Proxy] Failed to check staff status:', error);
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query) {
      return NextResponse.json({ error: 'Query parameter required' }, { status: 400 });
    }

    const giphyApiKey = process.env.GIPHY_API_KEY;
    if (!giphyApiKey) {
      console.error('[Giphy Proxy] GIPHY_API_KEY not configured');
      return NextResponse.json({ error: 'Giphy integration not configured' }, { status: 500 });
    }

    // Call Giphy API
    const giphyUrl = `https://api.giphy.com/v1/gifs/search?api_key=${giphyApiKey}&q=${encodeURIComponent(query)}&limit=20&rating=g`;

    const response = await fetch(giphyUrl);

    if (!response.ok) {
      console.error('[Giphy Proxy] Giphy API error:', response.statusText);
      return NextResponse.json({ error: 'Giphy API request failed' }, { status: 500 });
    }

    const data = await response.json();

    return NextResponse.json({ gifs: data.data || [] });
  } catch (error) {
    console.error('[Giphy Proxy] Unexpected error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
