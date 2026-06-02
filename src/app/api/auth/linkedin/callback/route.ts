import { NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import ConnectedAccount from "@/models/ConnectedAccount";
import {
  exchangeLinkedInCode,
  getLinkedInProfile,
  getLinkedInOrganizations,
} from "@/lib/auth/linkedin";
import { encrypt } from "@/lib/encryption";

/**
 * GET /api/auth/linkedin/callback
 * Handles the OAuth callback from LinkedIn.
 * Exchanges the code for a token, fetches the profile, and stores the account.
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

    // Exchange code for token
    const tokenData = await exchangeLinkedInCode(code);
    const accessToken = tokenData.access_token;
    const encryptedToken = encrypt(accessToken);

    // Fetch the member's profile
    const profile = await getLinkedInProfile(accessToken);
    const memberUrn = `urn:li:person:${profile.sub}`;

    // Save personal account
    await ConnectedAccount.findOneAndUpdate(
      { platform: "linkedin", externalAccountId: memberUrn },
      {
        platform: "linkedin",
        scopeType: "personal",
        displayName: profile.name,
        externalAccountId: memberUrn,
        accessToken: encryptedToken,
        tokenExpiresAt: new Date(
          Date.now() + tokenData.expires_in * 1000
        ),
        meta: { email: profile.email, picture: profile.picture },
      },
      { upsert: true, new: true }
    );

    // Try to fetch organizations (if scope was granted)
    const orgs = await getLinkedInOrganizations(accessToken);
    for (const org of orgs) {
      await ConnectedAccount.findOneAndUpdate(
        { platform: "linkedin", externalAccountId: org.organizationUrn },
        {
          platform: "linkedin",
          scopeType: "organization",
          displayName: org.displayName,
          externalAccountId: org.organizationUrn,
          accessToken: encryptedToken,
          tokenExpiresAt: new Date(
            Date.now() + tokenData.expires_in * 1000
          ),
          meta: { role: org.role, orgId: org.organizationId },
        },
        { upsert: true, new: true }
      );
    }

    return NextResponse.redirect(
      `${process.env.APP_URL}/accounts?success=linkedin`
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("LinkedIn callback error:", message);
    return NextResponse.redirect(
      `${process.env.APP_URL}/accounts?error=${encodeURIComponent(message)}`
    );
  }
}
