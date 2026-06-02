"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

interface Account {
  _id: string;
  platform: string;
  scopeType: string;
  displayName: string;
  externalAccountId: string;
  tokenExpiresAt?: string;
  meta?: Record<string, unknown>;
}

function AccountsContent() {
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const successParam = searchParams.get("success");
  const errorParam = searchParams.get("error");

  useEffect(() => {
    fetchAccounts();
  }, []);

  async function fetchAccounts() {
    try {
      const res = await fetch("/api/accounts");
      const data = await res.json();
      setAccounts(data.accounts || []);
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }

  async function disconnectAccount(accountId: string) {
    setDeletingId(accountId);
    try {
      await fetch("/api/accounts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });
      setAccounts((prev) => prev.filter((a) => a._id !== accountId));
    } finally {
      setDeletingId(null);
    }
  }

  function formatExpiry(dateStr?: string): string {
    if (!dateStr) return "No expiry info";
    const date = new Date(dateStr);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    if (diff < 0) return "Expired";
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days > 30) return `Expires in ${days} days`;
    if (days > 0) return `Expires in ${days} day${days === 1 ? "" : "s"}`;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    return `Expires in ${hours} hour${hours === 1 ? "" : "s"}`;
  }

  return (
    <main className="fade-in">
      <div className="page-header">
        <h1 className="page-title">Connected Accounts</h1>
        <p className="page-subtitle">
          Manage your social media connections
        </p>
      </div>

      {/* Status alerts */}
      {successParam === "linkedin" && (
        <div className="alert alert-success">
          <span>✓</span> LinkedIn account connected successfully!
        </div>
      )}
      {successParam === "meta" && (
        <div className="alert alert-success">
          <span>✓</span> Facebook &amp; Instagram accounts connected successfully!
        </div>
      )}
      {errorParam && (
        <div className="alert alert-error">
          <span>⚠</span> Error: {decodeURIComponent(errorParam)}
        </div>
      )}

      {/* Connect buttons */}
      <div className="connect-section">
        <a href="/api/auth/linkedin?type=personal" className="btn btn-linkedin" id="connect-linkedin-personal">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
          Connect LinkedIn (Personal)
        </a>
        <a href="/api/auth/linkedin?type=organization" className="btn btn-linkedin" id="connect-linkedin-org">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
          Connect LinkedIn (Organization)
        </a>
        <a href="/api/auth/meta" className="btn btn-meta" id="connect-meta">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
          Connect Facebook &amp; Instagram
        </a>
      </div>

      {/* Account list */}
      {loading ? (
        <div className="empty-state">
          <div className="spinner" style={{ margin: "0 auto", width: 32, height: 32 }} />
          <p className="empty-state-text" style={{ marginTop: 16 }}>Loading accounts...</p>
        </div>
      ) : accounts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📱</div>
          <p className="empty-state-text">No accounts connected yet</p>
          <p className="empty-state-hint">
            Use the buttons above to connect your LinkedIn, Facebook, or Instagram accounts
          </p>
        </div>
      ) : (
        <div className="accounts-grid">
          {accounts.map((account) => (
            <div key={account._id} className="card account-card" id={`account-${account._id}`}>
              <div className="account-platform">
                <span className={`account-platform-badge ${account.platform}`}>
                  {account.platform}
                </span>
                <span className="account-scope">{account.scopeType}</span>
              </div>
              <div className="account-name">{account.displayName}</div>
              <div className="account-id">{account.externalAccountId}</div>
              <div className="account-expiry">
                {formatExpiry(account.tokenExpiresAt)}
              </div>
              <div className="account-actions">
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => disconnectAccount(account._id)}
                  disabled={deletingId === account._id}
                  id={`disconnect-${account._id}`}
                >
                  {deletingId === account._id ? "Removing..." : "Disconnect"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

export default function AccountsPage() {
  return (
    <Suspense fallback={
      <div className="empty-state">
        <div className="spinner" style={{ margin: "0 auto", width: 32, height: 32 }} />
      </div>
    }>
      <AccountsContent />
    </Suspense>
  );
}
