import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabaseAdmin } from '@/lib/db/admin-client';
import { clerkClient } from '@clerk/nextjs/server';

/**
 * POST /api/blog/media/upload
 * Upload media to Supabase Storage (staff only)
 */
export async function POST(request: NextRequest) {
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
    console.error('[Blog Media Upload] Failed to check staff status:', error);
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const postId = formData.get('post_id') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Allowed: images and videos' }, { status: 400 });
    }

    // Validate file size (50MB max)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large. Maximum size: 50MB' }, { status: 400 });
    }

    // Generate storage path
    const timestamp = Date.now();
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${postId || 'temp'}/${timestamp}-${sanitizedFilename}`;

    // Convert file to array buffer
    const fileBuffer = await file.arrayBuffer();

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('blog-media')
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('[Blog Media Upload] Storage upload failed:', uploadError);
      return NextResponse.json({ error: 'Upload failed', details: uploadError.message }, { status: 500 });
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('blog-media')
      .getPublicUrl(storagePath);

    // Track in blog_media table
    const { data: mediaRecord, error: insertError } = await supabaseAdmin
      .from('blog_media')
      .insert({
        post_id: postId || null,
        url: publicUrl,
        storage_path: storagePath,
        media_type: file.type.startsWith('image/') ? 'image' : 'video',
        filename: file.name,
        size_bytes: file.size,
        created_by: ctx.userId,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[Blog Media Upload] Database insert failed:', insertError);
      // Still return success since file uploaded, just warn
    }

    return NextResponse.json({
      url: publicUrl,
      id: mediaRecord?.id,
      storage_path: storagePath,
    });
  } catch (error) {
    console.error('[Blog Media Upload] Unexpected error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
