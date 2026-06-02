import { NextResponse } from "next/server";
import { getMetaAuthUrl } from "@/lib/auth/meta";

/**
 * GET /api/auth/meta
 * Redirects to Meta (Facebook) OAuth authorization page.
 */
export async function GET() {
  const scopes = [
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_posts",
    "business_management",
    "instagram_basic",
    "instagram_content_publish",
  ];

  const authUrl = getMetaAuthUrl(scopes);
  return NextResponse.redirect(authUrl);
}
