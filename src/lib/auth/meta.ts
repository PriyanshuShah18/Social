import axios from "axios";

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface MetaPage {
  id: string;
  name: string;
  access_token: string;
  category?: string;
}

interface InstagramAccount {
  igUserId: string;
  username?: string;
  name?: string;
}

/**
 * Build the Meta (Facebook) OAuth authorization URL.
 * Supports two modes:
 *  1. If META_LOGIN_CONFIG_ID is set → uses Facebook Login for Business (config_id)
 *  2. Otherwise → falls back to traditional scope-based OAuth
 */
export function getMetaAuthUrl(scopes: string[]): string {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    redirect_uri: `${process.env.APP_URL}/api/auth/meta/callback`,
    response_type: "code",
    state: generateState(),
  });

  // Facebook Login for Business uses config_id instead of scope
  if (process.env.META_LOGIN_CONFIG_ID) {
    params.set("config_id", process.env.META_LOGIN_CONFIG_ID);
  } else {
    params.set("scope", scopes.join(","));
  }

  return `https://www.facebook.com/${process.env.META_GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}

/**
 * Exchange an authorization code for a short-lived user access token,
 * then exchange it for a long-lived token.
 */
export async function exchangeMetaCode(code: string): Promise<TokenResponse> {
  const version = process.env.META_GRAPH_VERSION || "v25.0";

  // Step 1: Get short-lived token
  const shortRes = await axios.get(
    `https://graph.facebook.com/${version}/oauth/access_token`,
    {
      params: {
        client_id: process.env.META_APP_ID!,
        client_secret: process.env.META_APP_SECRET!,
        redirect_uri: `${process.env.APP_URL}/api/auth/meta/callback`,
        code,
      },
    }
  );

  const shortToken = shortRes.data.access_token;

  // Step 2: Exchange for long-lived token
  try {
    const longRes = await axios.get(
      `https://graph.facebook.com/${version}/oauth/access_token`,
      {
        params: {
          grant_type: "fb_exchange_token",
          client_id: process.env.META_APP_ID!,
          client_secret: process.env.META_APP_SECRET!,
          fb_exchange_token: shortToken,
        },
      }
    );

    return {
      access_token: longRes.data.access_token,
      expires_in: longRes.data.expires_in || 5184000, // ~60 days
      token_type: "bearer",
    };
  } catch {
    // If long-lived exchange fails, use the short-lived token
    return {
      access_token: shortToken,
      expires_in: shortRes.data.expires_in || 3600,
      token_type: "bearer",
    };
  }
}

/**
 * Get all Pages the authenticated user manages, along with each Page's access token.
 */
export async function getManagedPages(userAccessToken: string): Promise<MetaPage[]> {
  const version = process.env.META_GRAPH_VERSION || "v25.0";

  const res = await axios.get(
    `https://graph.facebook.com/${version}/me/accounts`,
    {
      params: {
        access_token: userAccessToken,
        fields: "id,name,access_token,category",
      },
    }
  );

  return (res.data.data || []).map((page: Record<string, string>) => ({
    id: page.id,
    name: page.name,
    access_token: page.access_token,
    category: page.category,
  }));
}

/**
 * Given a Facebook Page, resolve the linked Instagram Professional account.
 */
export async function getInstagramBusinessAccount(
  pageId: string,
  pageAccessToken: string
): Promise<InstagramAccount | null> {
  const version = process.env.META_GRAPH_VERSION || "v25.0";

  try {
    const res = await axios.get(
      `https://graph.facebook.com/${version}/${pageId}`,
      {
        params: {
          fields: "instagram_business_account{id,username,name}",
          access_token: pageAccessToken,
        },
      }
    );

    const igAccount = res.data.instagram_business_account;
    if (!igAccount) return null;

    return {
      igUserId: igAccount.id,
      username: igAccount.username,
      name: igAccount.name,
    };
  } catch {
    console.warn(`Could not resolve Instagram account for Page ${pageId}`);
    return null;
  }
}

function generateState(): string {
  return Math.random().toString(36).substring(2, 15);
}
