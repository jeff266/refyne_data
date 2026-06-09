import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabaseAdmin } from '@/lib/db/admin-client';
import { clerkClient } from '@clerk/nextjs/server';

/**
 * GET /api/blog/posts/[id]
 * Fetch a single blog post (staff only)
 */
export async function GET(
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
    console.error('[Blog Post] Failed to check staff status:', error);
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('blog_posts')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    return NextResponse.json({ post: data });
  } catch (error) {
    console.error('[Blog Post] Unexpected error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/blog/posts/[id]
 * Update a blog post (staff only)
 */
export async function PATCH(
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
    console.error('[Blog Post] Failed to check staff status:', error);
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const updates = await request.json();

    // Always update the updated_at timestamp
    updates.updated_at = new Date().toISOString();

    // Calculate read time if body_html is provided
    if (updates.body_html) {
      updates.read_time = calculateReadTime(updates.body_html);
    }

    const { data, error } = await supabaseAdmin
      .from('blog_posts')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('[Blog Post] Update failed:', error);

      // Check for duplicate slug
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A post with this slug already exists' }, { status: 409 });
      }

      return NextResponse.json({ error: 'Failed to update post' }, { status: 500 });
    }

    return NextResponse.json({ success: true, post: data });
  } catch (error) {
    console.error('[Blog Post] Unexpected error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/blog/posts/[id]
 * Archive a blog post (soft delete) (staff only)
 */
export async function DELETE(
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
    console.error('[Blog Post] Failed to check staff status:', error);
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const { error } = await supabaseAdmin
      .from('blog_posts')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', params.id);

    if (error) {
      console.error('[Blog Post] Archive failed:', error);
      return NextResponse.json({ error: 'Failed to archive post' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Blog Post] Unexpected error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/**
 * Calculate estimated read time in minutes based on word count
 * Average reading speed: 200 words per minute
 */
function calculateReadTime(html: string): number {
  // Strip HTML tags
  const text = html.replace(/<[^>]*>/g, '');

  // Count words
  const words = text.trim().split(/\s+/).length;

  // Calculate read time (minimum 1 minute)
  const minutes = Math.ceil(words / 200);

  return Math.max(1, minutes);
}
