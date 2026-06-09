'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import TiptapEditor from '@/components/blog/TiptapEditor';
import { PrimaryBtn, GhostBtn, Card } from '@/components/refyne';
import { C, F } from '@/lib/design-tokens';

export default function EditPostPage() {
  const router = useRouter();
  const params = useParams();
  const postId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [bodyJson, setBodyJson] = useState<any>({});
  const [bodyHtml, setBodyHtml] = useState('');
  const [tag, setTag] = useState('general');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [coverImageAlt, setCoverImageAlt] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [featured, setFeatured] = useState(false);
  const [status, setStatus] = useState('draft');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Fetch existing post
  useEffect(() => {
    const fetchPost = async () => {
      try {
        const res = await fetch(`/api/blog/posts/${postId}`);
        const data = await res.json();
        const post = data.post;

        setTitle(post.title || '');
        setExcerpt(post.excerpt || '');
        setBodyJson(post.body_json || {});
        setBodyHtml(post.body_html || '');
        setTag(post.tag || 'general');
        setCoverImageUrl(post.cover_image_url || '');
        setCoverImageAlt(post.cover_image_alt || '');
        setSeoTitle(post.seo_title || '');
        setSeoDescription(post.seo_description || '');
        setFeatured(post.featured || false);
        setStatus(post.status || 'draft');
      } catch (error) {
        console.error('Failed to fetch post:', error);
      } finally {
        setLoading(false);
      }
    };

    if (postId) {
      fetchPost();
    }
  }, [postId]);

  // Auto-save effect
  useEffect(() => {
    if (!postId || loading) return;

    const timer = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await fetch(`/api/blog/posts/${postId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            excerpt,
            body_json: bodyJson,
            body_html: bodyHtml,
            tag,
            cover_image_url: coverImageUrl,
            cover_image_alt: coverImageAlt,
            seo_title: seoTitle,
            seo_description: seoDescription,
            featured,
          }),
        });
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (error) {
        console.error('Auto-save failed:', error);
        setSaveStatus('idle');
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [postId, loading, title, excerpt, bodyJson, bodyHtml, tag, coverImageUrl, coverImageAlt, seoTitle, seoDescription, featured]);

  const handleImageUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('post_id', postId || 'temp');

    const res = await fetch('/api/blog/media/upload', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    return data.url;
  };

  const publishPost = async () => {
    try {
      const res = await fetch(`/api/blog/posts/${postId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      alert(`Published! View at: ${data.url}`);
      setStatus('published');
    } catch (error) {
      console.error('Publish failed:', error);
      alert('Failed to publish post');
    }
  };

  const deletePost = async () => {
    if (!confirm('Are you sure you want to archive this post?')) return;

    try {
      await fetch(`/api/blog/posts/${postId}`, {
        method: 'DELETE',
      });
      router.push('/blog-admin');
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to archive post');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 32, background: C.bg, minHeight: '100vh' }}>
        <div style={{ color: C.text2 }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 24, padding: 32, background: C.bg, minHeight: '100vh' }}>
      {/* Left panel - Editor */}
      <div style={{ flex: '1 1 70%' }}>
        <Card style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
            <input
              type="text"
              placeholder="Post title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                flex: 1,
                fontSize: 32,
                fontWeight: 600,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                color: C.text,
                fontFamily: "'Lora', serif",
              }}
            />
            <button
              onClick={deletePost}
              style={{
                padding: '8px 16px',
                background: 'transparent',
                border: `1px solid ${C.red}`,
                borderRadius: 6,
                color: C.red,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Delete
            </button>
          </div>

          <TiptapEditor
            content={bodyJson}
            onChange={(json, html) => {
              setBodyJson(json);
              setBodyHtml(html);
            }}
            onImageUpload={handleImageUpload}
          />
        </Card>
      </div>

      {/* Right panel - Metadata */}
      <div style={{ flex: '1 1 30%' }}>
        <Card style={{ padding: 24, position: 'sticky', top: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 16, fontFamily: F.sans }}>
            Publish
          </h3>

          <div style={{ marginBottom: 16, fontSize: 12, color: C.text2 }}>
            Status: <strong style={{ color: C.text }}>{status}</strong>
          </div>

          <div style={{ marginBottom: 16, fontSize: 12, color: C.text2 }}>
            {saveStatus === 'saving' && 'Saving...'}
            {saveStatus === 'saved' && 'Saved ✓'}
          </div>

          {status !== 'published' && (
            <PrimaryBtn onClick={publishPost} style={{ width: '100%', marginBottom: 12 }}>
              Publish Now
            </PrimaryBtn>
          )}
          <GhostBtn onClick={() => router.push('/blog-admin')} style={{ width: '100%' }}>
            Back to List
          </GhostBtn>

          <hr style={{ border: 'none', borderTop: `1px solid ${C.border}`, margin: '24px 0' }} />

          <h3 style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 12, fontFamily: F.sans }}>
            Cover Image
          </h3>
          <input
            type="file"
            accept="image/*"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                try {
                  const url = await handleImageUpload(file);
                  setCoverImageUrl(url);
                } catch (error) {
                  console.error('Image upload failed:', error);
                }
              }
            }}
            style={{ marginBottom: 12, color: C.text, width: '100%' }}
          />
          {coverImageUrl && (
            <img src={coverImageUrl} alt="Cover" style={{ width: '100%', borderRadius: 4, marginBottom: 12 }} />
          )}
          <input
            type="text"
            placeholder="Alt text..."
            value={coverImageAlt}
            onChange={(e) => setCoverImageAlt(e.target.value)}
            style={{
              width: '100%',
              padding: 8,
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 4,
              color: C.text,
              fontSize: 12,
            }}
          />

          <hr style={{ border: 'none', borderTop: `1px solid ${C.border}`, margin: '24px 0' }} />

          <h3 style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 12, fontFamily: F.sans }}>
            Excerpt
          </h3>
          <textarea
            placeholder="Brief description..."
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            maxLength={300}
            style={{
              width: '100%',
              padding: 8,
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 4,
              color: C.text,
              fontSize: 12,
              minHeight: 80,
              resize: 'vertical',
              fontFamily: F.sans,
            }}
          />
          <div style={{ fontSize: 10, color: C.text3, textAlign: 'right' }}>{excerpt.length}/300</div>

          <hr style={{ border: 'none', borderTop: `1px solid ${C.border}`, margin: '24px 0' }} />

          <h3 style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 12, fontFamily: F.sans }}>Tag</h3>
          <select
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            style={{
              width: '100%',
              padding: 8,
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 4,
              color: C.text,
              fontSize: 12,
            }}
          >
            <option value="general">General</option>
            <option value="product">Product</option>
            <option value="revops">RevOps</option>
            <option value="ai">AI</option>
            <option value="case-study">Case Study</option>
            <option value="announcement">Announcement</option>
          </select>

          <hr style={{ border: 'none', borderTop: `1px solid ${C.border}`, margin: '24px 0' }} />

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ fontSize: 14, color: C.text }}>Feature this post</span>
          </label>
        </Card>
      </div>
    </div>
  );
}
