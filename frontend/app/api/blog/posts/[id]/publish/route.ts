import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabaseAdmin } from '@/lib/db/admin-client';
import { clerkClient } from '@clerk/nextjs/server';

/**
 * POST /api/blog/posts/[id]/publish
 * Publish a blog post (staff only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    console.error('[Blog Publish] Failed to check staff status:', error);
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const { published_at } = body;

    const { data, error } = await supabaseAdmin
      .from('blog_posts')
      .update({
        status: 'published',
        published_at: published_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('[Blog Publish] Update failed:', error);
      return NextResponse.json({ error: 'Failed to publish post' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      url: `https://blog.refynedata.com/${data.slug}`,
      post: data,
    });
  } catch (error) {
    console.error('[Blog Publish] Unexpected error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
