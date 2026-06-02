import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Social Posting Agent — Publish Everywhere",
  description:
    "Compose once, publish to LinkedIn, Facebook, and Instagram. A unified social media publishing tool.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="app-container">
          <nav className="nav">
            <a href="/" className="nav-brand">
              <div className="nav-logo">S</div>
              <span className="nav-title">Social Agent</span>
            </a>
            <div className="nav-links">
              <a href="/" className="nav-link">
                Compose
              </a>
              <a href="/accounts" className="nav-link">
                Accounts
              </a>
              <a href="/history" className="nav-link">
                History
              </a>
              <a href="/agent" className="nav-link">
                AI Agent
              </a>
            </div>
          </nav>
          {children}
        </div>
      </body>
    </html>
  );
}
