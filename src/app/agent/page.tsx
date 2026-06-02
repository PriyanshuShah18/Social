"use client";

import { useState, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import styles from "./agent.module.css";

/* ─── Types ─── */

interface AgentStep {
  name: string;
  status: "success" | "failed" | "skipped";
  detail?: string;
  durationMs?: number;
}

interface Blog {
  _id: string;
  topic: string;
  trendQuery: string;
  title: string;
  content: string;
  imagePrompt: string;
  imageUrl: string;
  externalUrl?: string;
  status: "draft" | "published";
  createdAt: string;
}

interface Trend {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface Account {
  _id: string;
  platform: string;
  scopeType: string;
  displayName: string;
  externalAccountId: string;
}

type ChannelType =
  | "linkedin_personal"
  | "linkedin_org"
  | "facebook_page"
  | "instagram";

/* ─── Helpers ─── */

function accountToChannel(account: Account): ChannelType {
  if (account.platform === "linkedin") {
    return account.scopeType === "organization"
      ? "linkedin_org"
      : "linkedin_personal";
  }
  if (account.platform === "facebook") return "facebook_page";
  return "instagram";
}

function getChannelLabel(channel: ChannelType): string {
  switch (channel) {
    case "linkedin_personal":
      return "LinkedIn Personal";
    case "linkedin_org":
      return "LinkedIn Organization";
    case "facebook_page":
      return "Facebook Page";
    case "instagram":
      return "Instagram";
    default:
      return channel;
  }
}

function getPlatformAbbrev(platform: string): string {
  switch (platform) {
    case "linkedin":
      return "in";
    case "facebook":
      return "f";
    case "instagram":
      return "IG";
    default:
      return "?";
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function stripMarkdown(md: string): string {
  return md
    .replace(/#{1,6}\s/g, "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/\n/g, " ")
    .trim();
}

/* ─── Component ─── */

export default function AgentPage() {
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingTrendTitle, setGeneratingTrendTitle] = useState<string | null>(null);
  const [steps, setSteps] = useState<AgentStep[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loadingTrends, setLoadingTrends] = useState(true);

  // Edit modal state
  const [editingBlog, setEditingBlog] = useState<Blog | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);

  // View modal state
  const [viewingBlog, setViewingBlog] = useState<Blog | null>(null);

  /* ── Fetch Blogs ── */
  const fetchBlogs = useCallback(async () => {
    try {
      const res = await fetch("/api/agent/blogs");
      const data = await res.json();
      setBlogs(data.blogs || []);
    } catch {
      setBlogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBlogs();
  }, [fetchBlogs]);

  /* ── Fetch Trends ── */
  useEffect(() => {
    fetch("/api/agent/trends")
      .then((r) => r.json())
      .then((data) => setTrends(data.trends || []))
      .catch(() => setTrends([]))
      .finally(() => setLoadingTrends(false));
  }, []);

  /* ── Generate Blog ── */
  async function handleGenerate(trend?: Trend) {
    setGenerating(true);
    setGeneratingTrendTitle(trend?.title || null);
    setSteps(null);
    setError(null);

    try {
      const body = trend ? JSON.stringify({ trendTitle: trend.title, trendContext: trend.content }) : undefined;
      const res = await fetch("/api/agent/generate", { 
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Generation failed");
        console.log("AGENT PIPELINE LOGS (ERROR):", data.steps);
        return;
      }

      console.log("AGENT PIPELINE LOGS (SUCCESS):", data.steps);
      await fetchBlogs(); // refresh list
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setGenerating(false);
      setGeneratingTrendTitle(null);
    }
  }

  /* ── Edit Blog ── */
  function openEdit(blog: Blog) {
    setEditingBlog(blog);
    setEditTitle(blog.title);
    setEditContent(blog.content);
  }

  async function saveEdit() {
    if (!editingBlog) return;
    setSaving(true);

    try {
      const res = await fetch(`/api/agent/blogs/${editingBlog._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, content: editContent }),
      });

      if (res.ok) {
        setEditingBlog(null);
        // Also update the viewingBlog if we are viewing the one we just edited
        if (viewingBlog && viewingBlog._id === editingBlog._id) {
          setViewingBlog({
            ...viewingBlog,
            title: editTitle,
            content: editContent,
          });
        }
        await fetchBlogs();
      }
    } finally {
      setSaving(false);
    }
  }

  /* ── Delete Blog ── */
  async function handleDelete(id: string) {
    try {
      await fetch(`/api/agent/blogs/${id}`, { method: "DELETE" });
      if (viewingBlog && viewingBlog._id === id) {
        setViewingBlog(null);
      }
      await fetchBlogs();
    } catch {
      // silent
    }
  }

  async function handlePublishWebsite(blog: Blog) {
    if (blog.status === "published") {
      alert("Already published to the website!");
      return;
    }
    const res = await fetch(`/api/agent/blogs/${blog._id}/publish`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setBlogs(blogs.map(b => b._id === blog._id ? { ...b, status: "published", externalUrl: data.externalUrl } : b));
      if (viewingBlog && viewingBlog._id === blog._id) {
        setViewingBlog({ ...viewingBlog, status: "published", externalUrl: data.externalUrl });
      }
      alert(`Successfully published to website!\nLive URL: ${data.externalUrl}`);
    } else {
      alert("Failed to publish to website.");
    }
  }

  /* ── Publish Blog (Copy Link) ── */
  async function handleCopyLink(blog: Blog) {
    const url = `${window.location.origin}/blog/${blog._id}`;
    
    try {
      await navigator.clipboard.writeText(url);
      
      // Update status to published
      if (blog.status === "draft") {
        await fetch(`/api/agent/blogs/${blog._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: blog.title, content: blog.content, status: "published" }),
        });
        
        if (viewingBlog && viewingBlog._id === blog._id) {
          setViewingBlog({ ...viewingBlog, status: "published" });
        }
        await fetchBlogs();
      }
      
      alert(`Public link copied to clipboard!\n${url}`);
    } catch (err) {
      alert("Failed to copy link.");
    }
  }

  /* ─── Render ─── */

  return (
    <main className="fade-in">
      {/* ── Header ── */}
      <div className={styles.headerRow}>
        <div>
          <h1>AI Blog Agent</h1>
          <p>
            Generate personalized blog posts based on today&apos;s market trends
          </p>
        </div>
        <button
          className={styles.generateBtn}
          onClick={() => handleGenerate()}
          disabled={generating}
          id="generate-blog-btn"
        >
          {generating ? (
            <>
              <span className={styles.generateBtnSpinner} />
              Generating…
            </>
          ) : (
            <>Generate Random Blog</>
          )}
        </button>
      </div>

      {/* ── Error Alert ── */}
      {error && (
        <div className="alert alert-error">
          <span>⚠</span> {error}
        </div>
      )}

      {/* ── Top Trends ── */}
      <div style={{ marginBottom: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{ fontSize: '24px' }}>🔥</div>
          <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
            Hot Market Trends
          </h2>
        </div>
        
        {loadingTrends ? (
          <div className={styles.trendsGrid}>
            <div className={`${styles.skeleton} ${styles.skeletonCard}`} style={{ height: '180px', marginBottom: 0 }} />
            <div className={`${styles.skeleton} ${styles.skeletonCard}`} style={{ height: '180px', marginBottom: 0 }} />
            <div className={`${styles.skeleton} ${styles.skeletonCard}`} style={{ height: '180px', marginBottom: 0 }} />
          </div>
        ) : trends.length === 0 ? (
          <div className={styles.emptyState} style={{ padding: '40px 20px' }}>
            <p className={styles.emptyTitle}>No trends found</p>
          </div>
        ) : (
          <div className={styles.trendsGrid}>
            {trends.map((trend, i) => (
              <div 
                key={i} 
                className={styles.trendCard}
                style={i === 0 ? { borderColor: 'var(--accent-primary)' } : {}}
                onClick={() => handleGenerate(trend)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <h3 className={styles.trendTitle} style={{ margin: 0 }}>{trend.title}</h3>
                  {i === 0 && (
                    <span style={{ fontSize: '10px', fontWeight: 'bold', backgroundColor: 'var(--accent-primary)', color: 'white', padding: '2px 8px', borderRadius: '12px', whiteSpace: 'nowrap', marginLeft: '12px' }}>
                      BEST MATCH
                    </span>
                  )}
                </div>
                <div className={styles.trendAction} style={{ marginTop: 'auto', paddingTop: '16px' }}>
                  {generating && generatingTrendTitle === trend.title ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)', opacity: 0.8 }}>
                      <span className={styles.spinner}></span> Generating...
                    </span>
                  ) : (
                    <>Generate Blog <span style={{ fontSize: '16px', lineHeight: 1 }}>→</span></>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Pipeline Steps Removed (Now logged to console) ── */}

      {/* ── Blog List ── */}
      {loading ? (
        <div>
          <div className={`${styles.skeleton} ${styles.skeletonCard}`} />
          <div className={`${styles.skeleton} ${styles.skeletonCard}`} />
        </div>
      ) : blogs.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🧠</div>
          <p className={styles.emptyTitle}>No blogs generated yet</p>
          <p className={styles.emptyHint}>
            Click &quot;Generate Today&apos;s Blog&quot; to have the AI agent research
            trends and write your first post.
          </p>
        </div>
      ) : (
        <div className={styles.blogsGrid}>
          {blogs.map((blog) => (
            <div 
              key={blog._id} 
              className={styles.blogCard}
              onClick={() => setViewingBlog(blog)}
            >
              <div className={styles.blogCardInner}>
                {/* Image */}
                <div className={styles.blogImageWrap}>
                  {blog.imageUrl ? (
                    <img
                      className={styles.blogImage}
                      src={blog.imageUrl}
                      alt={blog.title}
                    />
                  ) : (
                    <span className={styles.blogImagePlaceholder}>🖼️</span>
                  )}
                </div>

                {/* Content */}
                <div className={styles.blogBody}>
                  <div className={styles.blogTopRow} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <span
                        className={styles.topicBadge}
                        data-topic={blog.topic}
                      >
                        {blog.topic}
                      </span>
                      <span
                        className={`${styles.statusBadge} ${
                          blog.status === "published"
                            ? styles.published
                            : styles.draft
                        }`}
                      >
                        {blog.status}
                      </span>
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(blog._id);
                      }}
                      className={styles.deleteBtn}
                      title="Delete Blog"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                      </svg>
                    </button>
                  </div>

                  <h2 className={styles.blogTitle}>{blog.title}</h2>
                  <div className={styles.blogDate}>
                    {formatDate(blog.createdAt)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── View Modal ── */}
      {viewingBlog && (
        <div className={styles.editOverlay} onClick={() => setViewingBlog(null)}>
          <div className={styles.viewModal} onClick={(e) => e.stopPropagation()}>
            {viewingBlog.imageUrl ? (
              <img
                className={styles.viewModalImage}
                src={viewingBlog.imageUrl}
                alt={viewingBlog.title}
              />
            ) : (
              <div className={styles.viewModalImagePlaceholder}>🖼️</div>
            )}
            <div className={styles.viewModalBody}>
              <div className={styles.viewModalHeader}>
                <div className={styles.blogTopRow}>
                  <span className={styles.topicBadge} data-topic={viewingBlog.topic}>
                    {viewingBlog.topic}
                  </span>
                  <span
                    className={`${styles.statusBadge} ${
                      viewingBlog.status === "published"
                        ? styles.published
                        : styles.draft
                    }`}
                  >
                    {viewingBlog.status}
                  </span>
                  <span className={styles.blogDate} style={{ marginLeft: "auto", marginBottom: 0 }}>
                    {formatDate(viewingBlog.createdAt)}
                  </span>
                </div>
                <h2>{viewingBlog.title}</h2>
              </div>
              <div className={styles.viewModalContent}>
                <ReactMarkdown>{viewingBlog.content}</ReactMarkdown>
              </div>
              <div className={styles.blogActions} style={{ marginTop: 0 }}>
                <button
                  className={styles.btnEdit}
                  onClick={() => openEdit(viewingBlog)}
                >
                  ✏️ Edit
                </button>
                <button
                  className={styles.btnPublish}
                  onClick={() => handlePublishWebsite(viewingBlog)}
                  style={{ background: viewingBlog.status === "published" ? "var(--success)" : "var(--accent-primary)" }}
                >
                  {viewingBlog.status === "published" ? "✓ Published" : "🚀 Publish to Website"}
                </button>
                <button
                  className={styles.btnPublish}
                  onClick={() => handleCopyLink(viewingBlog)}
                >
                  🔗 Copy Link
                </button>
                <button
                  className={styles.btnDelete}
                  onClick={() => handleDelete(viewingBlog._id)}
                >
                  🗑 Delete
                </button>
                <button
                  className={styles.editCancel}
                  onClick={() => setViewingBlog(null)}
                  style={{ marginLeft: "auto", padding: "8px 18px", borderRadius: "var(--radius-sm)" }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editingBlog && (
        <div className={styles.editOverlay} onClick={() => setEditingBlog(null)}>
          <div className={styles.editModal} onClick={(e) => e.stopPropagation()}>
            <h2>Edit Blog Post</h2>

            <label htmlFor="edit-title">Title</label>
            <input
              id="edit-title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />

            <label htmlFor="edit-content">Content (Markdown)</label>
            <textarea
              id="edit-content"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
            />

            <div className={styles.editActions}>
              <button
                className={styles.editCancel}
                onClick={() => setEditingBlog(null)}
              >
                Cancel
              </button>
              <button
                className={styles.editSave}
                onClick={saveEdit}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Modal Ends ── */}
    </main>
  );
}
