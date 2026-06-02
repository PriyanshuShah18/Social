import { NextResponse } from "next/server";
import { getLinkedInAuthUrl } from "@/lib/auth/linkedin";

/**
 * GET /api/auth/linkedin
 * Redirects to LinkedIn OAuth authorization page.
 * Query param: ?type=personal|organization
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "personal";

  const scopes =
    type === "organization"
      ? ["openid", "profile", "email", "w_member_social", "w_organization_social"]
      : ["openid", "profile", "email", "w_member_social"];

  const authUrl = getLinkedInAuthUrl(scopes);
  return NextResponse.redirect(authUrl);
}
