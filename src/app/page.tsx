"use client";

import { useState, useEffect } from "react";

interface Account {
  _id: string;
  platform: string;
  scopeType: string;
  displayName: string;
  externalAccountId: string;
}

interface Blog {
  _id: string;
  title: string;
  content: string;
  imageUrl?: string;
  externalUrl?: string;
  createdAt: string;
  status: string;
}

interface PublishResultItem {
  channel: string;
  success: boolean;
  platformPostId?: string;
  error?: string;
}

type ChannelType = "linkedin_personal" | "linkedin_org" | "facebook_page" | "instagram";

function getChannelPlatform(channel: ChannelType): string {
  if (channel.startsWith("linkedin")) return "linkedin";
  if (channel === "facebook_page") return "facebook";
  return "instagram";
}

function getChannelLabel(channel: ChannelType): string {
  switch (channel) {
    case "linkedin_personal": return "LinkedIn Personal";
    case "linkedin_org": return "LinkedIn Organization";
    case "facebook_page": return "Facebook Page";
    case "instagram": return "Instagram";
    default: return channel;
  }
}

function getPlatformAbbrev(platform: string): string {
  switch (platform) {
    case "linkedin": return "in";
    case "facebook": return "f";
    case "instagram": return "IG";
    default: return "?";
  }
}

function accountToChannel(account: Account): ChannelType {
  if (account.platform === "linkedin") {
    return account.scopeType === "organization" ? "linkedin_org" : "linkedin_personal";
  }
  if (account.platform === "facebook") return "facebook_page";
  return "instagram";
}

export default function ComposePage() {
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [publishing, setPublishing] = useState(false);
  const [results, setResults] = useState<PublishResultItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [recentBlogs, setRecentBlogs] = useState<Blog[]>([]);

  // Fetch connected accounts on mount
  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((data) => setAccounts(data.accounts || []))
      .catch(() => setAccounts([]));

    // Fetch recent blogs
    fetch("/api/agent/blogs")
      .then((r) => r.json())
      .then((data) => {
        if (data.blogs && Array.isArray(data.blogs)) {
          // Keep top 2 published blogs, or just most recent 2
          const top2 = data.blogs.slice(0, 2);
          setRecentBlogs(top2);
        }
      })
      .catch(() => setRecentBlogs([]));
  }, []);

  function toggleAccount(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleSelectBlog(blog: Blog) {
    // 1. Remove markdown syntax completely to get clean text
    let plainText = blog.content
      .replace(/^#+\s+(.*)$/gm, "")             // Remove ALL headers (lines starting with #)
      .replace(/[*_]{1,2}(.*?)[*_]{1,2}/g, "$1") // Remove bold/italics
      .replace(/\[(.*?)\]\(.*?\)/g, "$1")       // Remove links
      .replace(/`/g, "")                        // Remove code backticks
      .trim();

    // 2. Split into blocks by ANY sequence of newlines (handles both \n and \n\n)
    const blocks = plainText.split(/\n+/);
    
    // 3. Find the first substantial paragraph
    let firstParagraph = "";
    for (const block of blocks) {
      const cleanBlock = block.trim();
      // Look for a real paragraph, not a tiny leftover fragment
      if (cleanBlock.length > 80) {
        firstParagraph = cleanBlock;
        break;
      }
    }
    
    // Fallback if no substantial paragraph is found
    if (!firstParagraph && blocks.length > 0) {
      firstParagraph = blocks[0];
    }
    
    setText(`${blog.title}\n\n${firstParagraph}`);
    setLink(blog.externalUrl || `${window.location.origin}/blog/${blog._id}`);
    
    if (blog.imageUrl) {
      setSelectedFile(null); // Clear any file
      setPreviewUrl(blog.imageUrl); // Use the existing remote image
    } else {
      removeFile();
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  }

  function removeFile() {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  }

  async function handlePublish() {
    if (!text.trim()) return;
    if (selectedIds.size === 0) {
      setError("Please select at least one channel.");
      return;
    }

    setPublishing(true);
    setResults(null);
    setError(null);

    try {
      const targets = Array.from(selectedIds).map((accountId) => {
        const account = accounts.find((a) => a._id === accountId);
        return {
          channel: account ? accountToChannel(account) : "linkedin_personal",
          accountId,
        };
      });

      // Upload image if selected
      let uploadedMediaUrl: string | undefined = undefined;
      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);

        try {
          const uploadRes = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });
          
          const uploadData = await uploadRes.json();
          
          if (!uploadRes.ok) {
            setError(uploadData.error || "Image upload failed");
            setPublishing(false);
            return;
          }
          
          uploadedMediaUrl = uploadData.url;
        } catch (err) {
          setError("Network error during image upload");
          setPublishing(false);
          return;
        }
      }

      const finalMediaUrl = uploadedMediaUrl || previewUrl;

      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          link: link.trim() || undefined,
          mediaUrls: finalMediaUrl ? [finalMediaUrl] : [],
          targets,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Publishing failed");
        return;
      }

      setResults(data.results);

      // Clear form on full success
      if (data.status === "success") {
        setText("");
        setLink("");
        setSelectedIds(new Set());
        removeFile();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setPublishing(false);
    }
  }

  const charCount = text.length;

  return (
    <main className="fade-in">
      <div className="page-header">
        <h1 className="page-title">Compose Post</h1>
        <p className="page-subtitle">
          Write once, publish to all your connected social channels
        </p>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>⚠</span> {error}
        </div>
      )}

      <div className="compose-layout">
        {/* Left — Compose Form */}
        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="form-group">
              <label className="form-label" htmlFor="post-text">Post Content</label>
              <textarea
                id="post-text"
                className="form-textarea"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What would you like to share today?"
                maxLength={3000}
              />
              <div className={`char-count ${charCount > 2800 ? "danger" : charCount > 2500 ? "warning" : ""}`}>
                {charCount} / 3,000
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 15, marginBottom: 15 }}>
              <label className="form-label">Attach Image (Optional)</label>
              
              {!previewUrl ? (
                <div>
                  <input
                    type="file"
                    id="image-upload"
                    accept="image/*"
                    onChange={handleFileChange}
                    style={{ display: "none" }}
                  />
                  <label htmlFor="image-upload" className="btn btn-secondary btn-sm" style={{ cursor: "pointer", display: "inline-block", marginTop: 5 }}>
                    📷 Select Image
                  </label>
                </div>
              ) : (
                <div style={{ position: "relative", display: "inline-block", marginTop: 10 }}>
                  <img 
                    src={previewUrl} 
                    alt="Preview" 
                    style={{ maxWidth: 200, maxHeight: 200, borderRadius: 8, objectFit: "cover", border: "1px solid var(--border-color)" }} 
                  />
                  <button 
                    onClick={removeFile}
                    style={{
                      position: "absolute",
                      top: -10,
                      right: -10,
                      background: "#ff4757",
                      color: "white",
                      border: "none",
                      borderRadius: "50%",
                      width: 24,
                      height: 24,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: "bold",
                      boxShadow: "0 2px 5px rgba(0,0,0,0.2)"
                    }}
                  >
                    ×
                  </button>
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="post-link">Link (optional)</label>
              <input
                id="post-link"
                className="form-input"
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://example.com"
              />
            </div>

            <button
              className="btn btn-primary btn-lg"
              style={{ width: "100%" }}
              onClick={handlePublish}
              disabled={publishing || !text.trim() || selectedIds.size === 0}
              id="publish-btn"
            >
              {publishing ? (
                <>
                  <span className="spinner" /> Publishing...
                </>
              ) : (
                <>🚀 Publish to {selectedIds.size} Channel{selectedIds.size !== 1 ? "s" : ""}</>
              )}
            </button>
          </div>

          {/* Results Panel */}
          {results && (
            <div className="card results-panel fade-in">
              <div className="card-header">
                <h3 className="card-title">Publish Results</h3>
              </div>
              <div className="results-list">
                {results.map((r, i) => (
                  <div key={i} className={`result-item ${r.success ? "success" : "error"}`}>
                    <div className={`result-status ${r.success ? "success" : "error"}`}>
                      {r.success ? "✓" : "✕"}
                    </div>
                    <span className="result-channel">{getChannelLabel(r.channel as ChannelType)}</span>
                    <span className="result-detail">
                      {r.success
                        ? `ID: ${r.platformPostId?.slice(0, 20) || "—"}...`
                        : r.error || "Failed"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right — Channel Selection & Quick Post */}
        <div>
          {recentBlogs.length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header" style={{ marginBottom: 15 }}>
                <h3 className="card-title">🚀 Quick Post: Recent Blogs</h3>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {recentBlogs.map((blog) => (
                  <div
                    key={blog._id}
                    className="channel-toggle"
                    style={{ alignItems: "flex-start", padding: "12px", border: "1px solid var(--border-color)", cursor: "pointer", transition: "all 0.2s" }}
                    onClick={() => handleSelectBlog(blog)}
                    role="button"
                    tabIndex={0}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="channel-name" style={{ marginBottom: 4, whiteSpace: "normal", lineHeight: 1.4 }}>{blog.title}</div>
                      <div className="channel-type" style={{ fontSize: 12 }}>
                        {new Date(blog.createdAt).toLocaleDateString()} • Click to load
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Channels</h3>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {selectedIds.size} selected
              </span>
            </div>

            {accounts.length === 0 ? (
              <div className="empty-state" style={{ padding: "30px 10px" }}>
                <div className="empty-state-icon">🔗</div>
                <p className="empty-state-text">No accounts connected</p>
                <p className="empty-state-hint" style={{ marginBottom: 16 }}>
                  Connect your social accounts to start publishing
                </p>
                <a href="/accounts" className="btn btn-primary btn-sm">
                  Connect Accounts
                </a>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {accounts.map((account) => {
                  const isActive = selectedIds.has(account._id);
                  const platform = account.platform;

                  return (
                    <div
                      key={account._id}
                      className={`channel-toggle ${isActive ? "active" : ""} ${platform}`}
                      onClick={() => toggleAccount(account._id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && toggleAccount(account._id)}
                      id={`channel-${account._id}`}
                    >
                      <div className={`channel-icon ${platform}`}>
                        {getPlatformAbbrev(platform)}
                      </div>
                      <div className="channel-info">
                        <div className="channel-name">{account.displayName}</div>
                        <div className="channel-type">
                          {getChannelLabel(accountToChannel(account))}
                        </div>
                      </div>
                      <div className="channel-check">
                        {isActive && <span style={{ color: "white", fontSize: 11 }}>✓</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
