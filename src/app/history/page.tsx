"use client";

import { useState, useEffect } from "react";

interface JobResult {
  channel: string;
  success: boolean;
  platformPostId?: string;
  error?: string;
}

interface Job {
  _id: string;
  text: string;
  link?: string;
  channels: string[];
  status: string;
  results: JobResult[];
  createdAt: string;
}

function getChannelLabel(channel: string): string {
  switch (channel) {
    case "linkedin_personal": return "LinkedIn Personal";
    case "linkedin_org": return "LinkedIn Org";
    case "facebook_page": return "Facebook Page";
    case "instagram": return "Instagram";
    default: return channel;
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HistoryPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/publish")
      .then((r) => r.json())
      .then((data) => setJobs(data.jobs || []))
      .catch(() => setJobs([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="fade-in">
      <div className="page-header">
        <h1 className="page-title">Post History</h1>
        <p className="page-subtitle">
          Review your recent publishing activity
        </p>
      </div>

      {loading ? (
        <div className="empty-state">
          <div className="spinner" style={{ margin: "0 auto", width: 32, height: 32 }} />
          <p className="empty-state-text" style={{ marginTop: 16 }}>Loading history...</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📝</div>
          <p className="empty-state-text">No posts yet</p>
          <p className="empty-state-hint" style={{ marginBottom: 16 }}>
            Your publish history will appear here after your first post
          </p>
          <a href="/" className="btn btn-primary btn-sm">
            Compose Your First Post
          </a>
        </div>
      ) : (
        <div className="history-list">
          {jobs.map((job) => (
            <div
              key={job._id}
              className="history-item card"
              id={`job-${job._id}`}
              onClick={() => setExpandedId(expandedId === job._id ? null : job._id)}
              style={{ cursor: "pointer" }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div className="history-text">{job.text}</div>
                  <div className="history-meta">
                    <span className={`history-status ${job.status}`}>
                      {job.status}
                    </span>
                    <span>{formatDate(job.createdAt)}</span>
                    <span>
                      {job.channels.length} channel{job.channels.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
                <span style={{ color: "var(--text-muted)", fontSize: 18, transition: "transform 0.2s", transform: expandedId === job._id ? "rotate(180deg)" : "rotate(0)" }}>
                  ▾
                </span>
              </div>

              {/* Expanded results */}
              {expandedId === job._id && job.results.length > 0 && (
                <div className="results-list fade-in" style={{ marginTop: 16 }}>
                  {job.results.map((r, i) => (
                    <div key={i} className={`result-item ${r.success ? "success" : "error"}`}>
                      <div className={`result-status ${r.success ? "success" : "error"}`}>
                        {r.success ? "✓" : "✕"}
                      </div>
                      <span className="result-channel">{getChannelLabel(r.channel)}</span>
                      <span className="result-detail">
                        {r.success
                          ? r.platformPostId
                            ? `ID: ${r.platformPostId.slice(0, 25)}...`
                            : "Published"
                          : r.error || "Failed"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
