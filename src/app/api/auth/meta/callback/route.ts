import { NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import ConnectedAccount from "@/models/ConnectedAccount";
import {
  exchangeMetaCode,
  getManagedPages,
  getInstagramBusinessAccount,
} from "@/lib/auth/meta";
import { encrypt } from "@/lib/encryption";

/**
 * GET /api/auth/meta/callback
 * Handles the OAuth callback from Meta (Facebook).
 * Exchanges code, fetches managed Pages, resolves Instagram accounts,
 * and stores all connected accounts.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      return NextResponse.redirect(
        `${process.env.APP_URL}/accounts?error=${encodeURIComponent(error)}`
      );
    }

    if (!code) {
      return NextResponse.redirect(
        `${process.env.APP_URL}/accounts?error=missing_code`
      );
    }

    await connectDB();

    // Exchange code for long-lived token
    const tokenData = await exchangeMetaCode(code);
    const userAccessToken = tokenData.access_token;

    // Get all Pages the user manages
    const pages = await getManagedPages(userAccessToken);
    
    // Diagnostic logging
    console.log("----- META DIAGNOSTICS -----");
    console.log("Pages returned by Meta:", JSON.stringify(pages, null, 2));
    try {
       const axios = require("axios");
       const debugRes = await axios.get(`https://graph.facebook.com/${process.env.META_GRAPH_VERSION || "v25.0"}/debug_token`, {
         params: {
           input_token: userAccessToken,
           access_token: `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`
         }
       });
       console.log("Token scopes granted:", debugRes.data.data.scopes);
    } catch (e: any) {
       console.log("Could not debug token:", e?.response?.data || e.message);
    }
    console.log("----------------------------");

    if (pages.length === 0) {
      return NextResponse.redirect(
        `${process.env.APP_URL}/accounts?error=no_pages_found`
      );
    }

    for (const page of pages) {
      // Store each Facebook Page as a connected account
      const encryptedPageToken = encrypt(page.access_token);

      await ConnectedAccount.findOneAndUpdate(
        { platform: "facebook", externalAccountId: page.id },
        {
          platform: "facebook",
          scopeType: "page",
          displayName: page.name,
          externalAccountId: page.id,
          accessToken: encryptedPageToken,
          tokenExpiresAt: new Date(
            Date.now() + tokenData.expires_in * 1000
          ),
          meta: { category: page.category },
        },
        { upsert: true, new: true }
      );

      // Try to resolve a linked Instagram professional account
      const igAccount = await getInstagramBusinessAccount(
        page.id,
        page.access_token
      );

      if (igAccount) {
        await ConnectedAccount.findOneAndUpdate(
          { platform: "instagram", externalAccountId: igAccount.igUserId },
          {
            platform: "instagram",
            scopeType: "instagram_business",
            displayName: igAccount.name || igAccount.username || `IG ${igAccount.igUserId}`,
            externalAccountId: igAccount.igUserId,
            accessToken: encryptedPageToken, // Uses the Page token
            tokenExpiresAt: new Date(
              Date.now() + tokenData.expires_in * 1000
            ),
            meta: {
              username: igAccount.username,
              linkedPageId: page.id,
              linkedPageName: page.name,
            },
          },
          { upsert: true, new: true }
        );
      }
    }

    return NextResponse.redirect(
      `${process.env.APP_URL}/accounts?success=meta`
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Meta callback error:", message);
    return NextResponse.redirect(
      `${process.env.APP_URL}/accounts?error=${encodeURIComponent(message)}`
    );
  }
}
