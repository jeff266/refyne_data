'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PrimaryBtn, Card } from '@/components/refyne';
import { C, F } from '@/lib/design-tokens';
import { FileText, Edit, Trash2, Eye } from 'lucide-react';

type Tab = 'all' | 'draft' | 'review' | 'published' | 'archived';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  tag: string;
  status: string;
  author_name: string;
  published_at: string | null;
  featured: boolean;
  created_at: string;
  updated_at: string;
}

export default function BlogAdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchPosts();
  }, [activeTab]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const status = activeTab === 'all' ? '' : activeTab;
      const res = await fetch(`/api/blog/posts${status ? `?status=${status}` : ''}`);
      const data = await res.json();
      setPosts(data.posts || []);
    } catch (error) {
      console.error('Failed to fetch posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFeatured = async (id: string, featured: boolean) => {
    try {
      await fetch(`/api/blog/posts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featured }),
      });
      fetchPosts();
    } catch (error) {
      console.error('Failed to toggle featured:', error);
    }
  };

  const deletePost = async (id: string) => {
    if (!confirm('Are you sure you want to archive this post?')) return;

    try {
      await fetch(`/api/blog/posts/${id}`, { method: 'DELETE' });
      fetchPosts();
    } catch (error) {
      console.error('Failed to delete post:', error);
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'draft', label: 'Drafts' },
    { id: 'review', label: 'Review' },
    { id: 'published', label: 'Published' },
    { id: 'archived', label: 'Archived' },
  ];

  const getTagColor = (tag: string) => {
    const colors: Record<string, string> = {
      product: C.indigo,
      revops: C.blue,
      ai: C.green,
      'case-study': C.amber,
      announcement: C.red,
      general: C.text3,
    };
    return colors[tag] || C.text3;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: C.amber,
      review: C.blue,
      published: C.green,
      archived: C.text3,
    };
    return colors[status] || C.text3;
  };

  return (
    <div style={{ padding: 32, background: C.bg, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 32, alignItems: 'center' }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, color: C.text, fontFamily: F.sans }}>Blog</h1>
        <PrimaryBtn onClick={() => router.push('/blog-admin/new')}>
          <FileText size={16} />
          New Post
        </PrimaryBtn>
      </div>

      {/* Tabs */}
      <nav style={{ display: 'flex', gap: 32, borderBottom: `1px solid ${C.border}`, marginBottom: 24 }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 0',
              borderBottom: activeTab === tab.id ? `2px solid ${C.indigo}` : '2px solid transparent',
              color: activeTab === tab.id ? C.text : C.text2,
              fontSize: 14,
              fontWeight: 500,
              background: 'none',
              cursor: 'pointer',
              border: 'none',
              transition: 'all 0.2s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Table */}
      <Card>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: C.text2 }}>Loading...</div>
        ) : posts.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: C.text2 }}>No posts found</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                <th style={{ padding: 12, textAlign: 'left', color: C.text2, fontSize: 12, fontWeight: 500 }}>
                  Title
                </th>
                <th style={{ padding: 12, textAlign: 'left', color: C.text2, fontSize: 12, fontWeight: 500 }}>Tag</th>
                <th style={{ padding: 12, textAlign: 'left', color: C.text2, fontSize: 12, fontWeight: 500 }}>
                  Status
                </th>
                <th style={{ padding: 12, textAlign: 'left', color: C.text2, fontSize: 12, fontWeight: 500 }}>
                  Author
                </th>
                <th style={{ padding: 12, textAlign: 'left', color: C.text2, fontSize: 12, fontWeight: 500 }}>
                  Published
                </th>
                <th style={{ padding: 12, textAlign: 'left', color: C.text2, fontSize: 12, fontWeight: 500 }}>
                  Featured
                </th>
                <th style={{ padding: 12, textAlign: 'left', color: C.text2, fontSize: 12, fontWeight: 500 }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: 12, color: C.text, fontSize: 14 }}>{post.title}</td>
                  <td style={{ padding: 12 }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 500,
                        background: `${getTagColor(post.tag)}20`,
                        color: getTagColor(post.tag),
                      }}
                    >
                      {post.tag}
                    </span>
                  </td>
                  <td style={{ padding: 12 }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 500,
                        background: `${getStatusColor(post.status)}20`,
                        color: getStatusColor(post.status),
                      }}
                    >
                      {post.status}
                    </span>
                  </td>
                  <td style={{ padding: 12, color: C.text2, fontSize: 13 }}>{post.author_name}</td>
                  <td style={{ padding: 12, color: C.text2, fontSize: 13 }}>
                    {post.published_at ? new Date(post.published_at).toLocaleDateString() : '—'}
                  </td>
                  <td style={{ padding: 12 }}>
                    <input
                      type="checkbox"
                      checked={post.featured}
                      onChange={() => toggleFeatured(post.id, !post.featured)}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                  <td style={{ padding: 12 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => router.push(`/blog-admin/${post.id}`)}
                        style={{
                          padding: 4,
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <Edit size={16} color={C.text2} />
                      </button>
                      <button
                        onClick={() => deletePost(post.id)}
                        style={{
                          padding: 4,
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <Trash2 size={16} color={C.red} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
