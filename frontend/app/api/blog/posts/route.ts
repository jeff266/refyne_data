import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabaseAdmin } from '@/lib/db/admin-client';
import { clerkClient } from '@clerk/nextjs/server';
import { z } from 'zod';

/**
 * GET /api/blog/posts
 * List blog posts with optional status filter (staff only)
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
    console.error('[Blog Posts] Failed to check staff status:', error);
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = supabaseAdmin
      .from('blog_posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: posts, error } = await query;

    if (error) {
      console.error('[Blog Posts] Query failed:', error);
      return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
    }

    return NextResponse.json({ posts: posts || [] });
  } catch (error) {
    console.error('[Blog Posts] Unexpected error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/**
 * POST /api/blog/posts
 * Create a new blog post (staff only)
 */
export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  // Check if user is Refyne staff
  let user;
  try {
    const client = await clerkClient();
    user = await client.users.getUser(ctx.userId);
    const isStaff = user.publicMetadata?.isRefyneStaff === true;

    if (!isStaff) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } catch (error) {
    console.error('[Blog Posts] Failed to check staff status:', error);
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    // Validate request body
    const createBlogPostSchema = z.object({
      title: z.string().optional(),
      slug: z.string().optional(),
      excerpt: z.string().optional(),
      body_json: z.any().optional(),
      body_html: z.string().optional(),
      tag: z.string().optional(),
      seo_title: z.string().optional(),
      seo_description: z.string().optional(),
      featured: z.boolean().optional(),
      cover_image_url: z.string().optional(),
      cover_image_alt: z.string().optional(),
    });

    const rawBody = await request.json();
    const validation = createBlogPostSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      );
    }
    const body = validation.data;

    const { title, slug, excerpt, body_json, body_html, tag, seo_title, seo_description, featured, cover_image_url, cover_image_alt } = body;

    // Generate slug from title if not provided
    const finalSlug = slug || generateSlug(title || 'Untitled Post');

    // Get author name from user
    const authorName = user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : 'Refyne Team';

    const { data, error } = await supabaseAdmin
      .from('blog_posts')
      .insert({
        title: title || 'Untitled Post',
        slug: finalSlug,
        excerpt,
        body_json: body_json || {},
        body_html,
        tag: tag || 'general',
        seo_title,
        seo_description,
        featured: featured || false,
        cover_image_url,
        cover_image_alt,
        created_by: ctx.userId,
        author_name: authorName,
      })
      .select()
      .single();

    if (error) {
      console.error('[Blog Posts] Insert failed:', error);

      // Check for duplicate slug
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A post with this slug already exists' }, { status: 409 });
      }

      return NextResponse.json({ error: 'Failed to create post' }, { status: 500 });
    }

    return NextResponse.json({ post: data, admin_url: `/blog-admin/${data.id}` });
  } catch (error) {
    console.error('[Blog Posts] Unexpected error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/**
 * Generate URL-friendly slug from title
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-')      // Replace spaces with hyphens
    .replace(/-+/g, '-')       // Replace multiple hyphens with single
    + '-' + Date.now();        // Add timestamp for uniqueness
}
