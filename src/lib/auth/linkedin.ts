import axios from "axios";

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

interface LinkedInProfile {
  sub: string;
  name: string;
  email?: string;
  picture?: string;
}

interface LinkedInOrganization {
  organizationId: string;
  organizationUrn: string;
  displayName: string;
  role: string;
}

/**
 * Build the LinkedIn OAuth authorization URL.
 */
export function getLinkedInAuthUrl(scopes: string[]): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LINKEDIN_CLIENT_ID!,
    redirect_uri: `${process.env.APP_URL}/api/auth/linkedin/callback`,
    scope: scopes.join(" "),
    state: generateState(),
  });

  return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
}

/**
 * Exchange an authorization code for an access token.
 */
export async function exchangeLinkedInCode(code: string): Promise<TokenResponse> {
  const res = await axios.post(
    "https://www.linkedin.com/oauth/v2/accessToken",
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${process.env.APP_URL}/api/auth/linkedin/callback`,
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
    }).toString(),
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }
  );

  return res.data;
}

/**
 * Fetch the authenticated member's profile using OpenID Connect userinfo.
 */
export async function getLinkedInProfile(accessToken: string): Promise<LinkedInProfile> {
  const res = await axios.get("https://api.linkedin.com/v2/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return {
    sub: res.data.sub,
    name: res.data.name,
    email: res.data.email,
    picture: res.data.picture,
  };
}

/**
 * Fetch organizations the authenticated member administers.
 * Requires r_organization_admin or equivalent scope.
 */
export async function getLinkedInOrganizations(
  accessToken: string
): Promise<LinkedInOrganization[]> {
  const version = process.env.LINKEDIN_API_VERSION || "202606";

  try {
    const res = await axios.get(
      "https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&projection=(elements*(organization~(localizedName),roleAssignee))",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Linkedin-Version": version,
          "X-Restli-Protocol-Version": "2.0.0",
        },
      }
    );

    const elements = res.data.elements || [];
    return elements.map((el: Record<string, unknown>) => {
      const org = el["organization~"] as Record<string, string> | undefined;
      const orgUrn = el.organization as string;
      const orgId = orgUrn.split(":").pop() || "";

      return {
        organizationId: orgId,
        organizationUrn: orgUrn,
        displayName: org?.localizedName || `Organization ${orgId}`,
        role: "ADMINISTRATOR",
      };
    });
  } catch {
    // If the scope isn't available, return empty
    console.warn("Could not fetch LinkedIn organizations. Scope may not be granted.");
    return [];
  }
}

function generateState(): string {
  return Math.random().toString(36).substring(2, 15);
}
