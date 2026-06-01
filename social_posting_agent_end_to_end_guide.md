# End-to-End Social Posting Agent

This document gives you a complete, practical setup for a single “Publish” action that can post to:

- **LinkedIn organization page**
- **LinkedIn personal profile** for testing
- **Facebook Page**
- **Instagram professional account** linked to a Facebook Page

The design uses one backend service with per-platform adapters. That is the correct model because each platform has different authentication, permissions, media handling, and publish endpoints.

## What this agent does

1. User writes a post in your app.
2. User selects channels: LinkedIn org, LinkedIn personal, Facebook Page, Instagram.
3. Backend validates content and media.
4. Backend sends each channel to its own publisher.
5. Each publisher calls the relevant platform API.
6. Backend stores a per-channel result with success/failure and platform post ID.

## Important platform constraints

### LinkedIn
- The current publishing API is the **Posts API**.
- For organization posting, the authenticated member must have one of these roles on the company page:
  - `ADMINISTRATOR`
  - `DIRECT_SPONSORED_CONTENT_POSTER`
  - `CONTENT_ADMIN`
- For personal testing, use `w_member_social`.
- The Posts API requires:
  - `Linkedin-Version: YYYYMM`
  - `X-Restli-Protocol-Version: 2.0.0`
- The Posts API supports text, images, videos, documents, and other post types.
- Media posts require asset URNs first.

### Facebook
- Posting to a Facebook Page uses the **Pages API** / Graph API.
- You need a **Page access token**.
- `pages_manage_posts` is the key permission for creating and managing Page posts.

### Instagram
- Publishing only works for **Instagram Professional accounts**:
  - Business
  - Creator
- The Instagram account must be linked to a Facebook Page.
- Publishing uses a **create media container → publish container** flow.
- Single image, video, reel, and carousel publishing are supported.

## Recommended architecture

```text
frontend/
  compose page
  channel toggles
  media upload

backend/
  auth/
    linkedin.ts
    meta.ts
  publish/
    linkedin.ts
    facebook.ts
    instagram.ts
  queue/
    publish-job.ts
  db/
    prisma or SQL models
  routes/
    publish.ts
    oauth.ts
    callback.ts
```

## Tech stack that is easiest to ship

- **Frontend:** Next.js
- **Backend:** Next.js API routes or Express
- **DB:** PostgreSQL
- **Job queue:** BullMQ + Redis
- **File storage:** S3 or similar
- **Secrets:** encrypted DB fields or a secret manager

If you want the fastest build, use a single Next.js app with API routes plus a worker process.

## Environment variables

```bash
APP_URL=http://localhost:3000
DATABASE_URL=postgresql://user:pass@localhost:5432/socialagent
REDIS_URL=redis://localhost:6379

LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...
LINKEDIN_REDIRECT_URI=http://localhost:3000/api/auth/linkedin/callback
LINKEDIN_API_VERSION=202606

META_APP_ID=...
META_APP_SECRET=...
META_REDIRECT_URI=http://localhost:3000/api/auth/meta/callback
META_GRAPH_VERSION=v25.0

ENCRYPTION_KEY=32-byte-random-key-base64-or-hex
```

## Data model

### ConnectedAccount
Store one row per connected account per platform.

```ts
export type Platform = "linkedin" | "facebook" | "instagram";
export type ScopeType = "personal" | "organization" | "page" | "instagram_business";

export interface ConnectedAccount {
  id: string;
  platform: Platform;
  scopeType: ScopeType;
  displayName: string;
  externalAccountId: string; // e.g. LinkedIn org URN, Page ID, IG user ID
  accessToken: string;       // encrypted at rest
  refreshToken?: string;     // if available
  tokenExpiresAt?: string;
  meta?: Record<string, any>;
}
```

### PublishJob

```ts
export type PublishStatus = "queued" | "processing" | "success" | "failed";

export interface PublishJob {
  id: string;
  title: string;
  text: string;
  link?: string;
  mediaUrls?: string[];
  channels: Array<"linkedin_org" | "linkedin_personal" | "facebook_page" | "instagram">;
  status: PublishStatus;
  results: Array<{
    channel: string;
    success: boolean;
    platformPostId?: string;
    error?: string;
  }>;
  createdBy: string;
  createdAt: string;
}
```

## OAuth flow

You need one OAuth connection per platform/account you want to publish as.

### LinkedIn OAuth
1. Send user to LinkedIn authorization URL.
2. Ask for:
   - `w_member_social` for personal testing
   - `w_organization_social` for organization posting
3. Exchange code for access token.
4. Store token and the selected actor identity:
   - personal member URN for testing
   - organization URN for company posts

### Meta OAuth
1. Send user to Meta authorization URL.
2. Request the relevant permissions for Pages and Instagram publishing.
3. Exchange code for a user token.
4. Get the user’s managed Pages.
5. From the Page, derive the Page access token.
6. For Instagram, resolve the linked Instagram professional account ID.

## LinkedIn publishing

### Personal testing post
Use the authenticated member’s URN as the author.

### Organization post
Use the organization URN as the author.
The authenticated member must have the required company page role.

### Text-only example

```ts
async function publishLinkedInTextPost(params: {
  accessToken: string;
  version: string;
  authorUrn: string; // urn:li:person:... or urn:li:organization:...
  text: string;
}) {
  const res = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "X-Restli-Protocol-Version": "2.0.0",
      "Linkedin-Version": params.version,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      author: params.authorUrn,
      commentary: params.text,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LinkedIn publish failed: ${res.status} ${body}`);
  }

  const postId = res.headers.get("x-restli-id");
  return postId ?? "";
}
```

### Notes for LinkedIn media posts
If you post images, videos, or documents, upload the asset first and then reference the returned asset URN in the post body.

## Facebook Page publishing

Use a Page access token and create the Page post.

```ts
async function publishFacebookPagePost(params: {
  pageId: string;
  pageAccessToken: string;
  text: string;
  link?: string;
}) {
  const url = new URL(`https://graph.facebook.com/${process.env.META_GRAPH_VERSION}/${params.pageId}/feed`);
  url.searchParams.set("message", params.text);
  if (params.link) url.searchParams.set("link", params.link);
  url.searchParams.set("access_token", params.pageAccessToken);

  const res = await fetch(url.toString(), { method: "POST" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Facebook publish failed: ${res.status} ${body}`);
  }

  const json = await res.json();
  return json.id as string;
}
```

If you are publishing media to Facebook Pages, use the relevant photo/video endpoint instead of `/feed`.

## Instagram publishing

Instagram publishing is a two-step process:
1. Create a media container.
2. Publish the container.

### Single image example

```ts
async function createInstagramImageContainer(params: {
  igUserId: string;
  accessToken: string;
  imageUrl: string;
  caption: string;
}) {
  const url = new URL(`https://graph.facebook.com/${process.env.META_GRAPH_VERSION}/${params.igUserId}/media`);
  url.searchParams.set("image_url", params.imageUrl);
  url.searchParams.set("caption", params.caption);
  url.searchParams.set("access_token", params.accessToken);

  const res = await fetch(url.toString(), { method: "POST" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Instagram container creation failed: ${res.status} ${body}`);
  }

  const json = await res.json();
  return json.id as string;
}

async function publishInstagramContainer(params: {
  igUserId: string;
  accessToken: string;
  creationId: string;
}) {
  const url = new URL(`https://graph.facebook.com/${process.env.META_GRAPH_VERSION}/${params.igUserId}/media_publish`);
  url.searchParams.set("creation_id", params.creationId);
  url.searchParams.set("access_token", params.accessToken);

  const res = await fetch(url.toString(), { method: "POST" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Instagram publish failed: ${res.status} ${body}`);
  }

  const json = await res.json();
  return json.id as string;
}
```

## Unified publish service

```ts
type ChannelTarget =
  | { channel: "linkedin_org"; accountId: string }
  | { channel: "linkedin_personal"; accountId: string }
  | { channel: "facebook_page"; accountId: string }
  | { channel: "instagram"; accountId: string };

export async function publishToChannels(input: {
  text: string;
  link?: string;
  mediaUrls?: string[];
  targets: ChannelTarget[];
  store: {
    getAccount(accountId: string): Promise<ConnectedAccount>;
  };
}) {
  const results: Array<{
    channel: string;
    success: boolean;
    platformPostId?: string;
    error?: string;
  }> = [];

  for (const target of input.targets) {
    try {
      const account = await input.store.getAccount(target.accountId);

      if (target.channel === "linkedin_org" || target.channel === "linkedin_personal") {
        const postId = await publishLinkedInTextPost({
          accessToken: account.accessToken,
          version: process.env.LINKEDIN_API_VERSION!,
          authorUrn: account.externalAccountId,
          text: input.text,
        });
        results.push({ channel: target.channel, success: true, platformPostId: postId });
        continue;
      }

      if (target.channel === "facebook_page") {
        const postId = await publishFacebookPagePost({
          pageId: account.externalAccountId,
          pageAccessToken: account.accessToken,
          text: input.text,
          link: input.link,
        });
        results.push({ channel: target.channel, success: true, platformPostId: postId });
        continue;
      }

      if (target.channel === "instagram") {
        if (!input.mediaUrls?.length) {
          throw new Error("Instagram requires media.");
        }
        const creationId = await createInstagramImageContainer({
          igUserId: account.externalAccountId,
          accessToken: account.accessToken,
          imageUrl: input.mediaUrls[0],
          caption: input.text,
        });
        const postId = await publishInstagramContainer({
          igUserId: account.externalAccountId,
          accessToken: account.accessToken,
          creationId,
        });
        results.push({ channel: target.channel, success: true, platformPostId: postId });
        continue;
      }
    } catch (err: any) {
      results.push({
        channel: target.channel,
        success: false,
        error: err?.message ?? "Unknown error",
      });
    }
  }

  return results;
}
```

## API route

```ts
import type { NextApiRequest, NextApiResponse } from "next";
import { publishToChannels } from "@/lib/publishToChannels";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { text, link, mediaUrls, targets } = req.body ?? {};

  if (!text || !Array.isArray(targets)) {
    return res.status(400).json({ error: "Missing text or targets" });
  }

  const results = await publishToChannels({
    text,
    link,
    mediaUrls,
    targets,
    store: {
      async getAccount(accountId: string) {
        // Replace with real DB lookup
        throw new Error(`Implement getAccount(${accountId})`);
      },
    },
  });

  return res.status(200).json({ results });
}
```

## Frontend compose form

```tsx
import { useState } from "react";

export default function Composer() {
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [posting, setPosting] = useState(false);

  async function handleSubmit() {
    setPosting(true);
    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          link: link || undefined,
          targets: [
            { channel: "linkedin_org", accountId: "YOUR_LINKEDIN_ORG_ACCOUNT_ID" },
            { channel: "linkedin_personal", accountId: "YOUR_LINKEDIN_PERSONAL_ACCOUNT_ID" },
            { channel: "facebook_page", accountId: "YOUR_FACEBOOK_PAGE_ACCOUNT_ID" },
            { channel: "instagram", accountId: "YOUR_INSTAGRAM_ACCOUNT_ID" },
          ],
        }),
      });
      console.log(await res.json());
    } finally {
      setPosting(false);
    }
  }

  return (
    <div>
      <textarea value={text} onChange={e => setText(e.target.value)} />
      <input value={link} onChange={e => setLink(e.target.value)} />
      <button onClick={handleSubmit} disabled={posting}>Publish</button>
    </div>
  );
}
```

## Testing strategy

### LinkedIn personal
- Connect your own member account.
- Give it `w_member_social`.
- Verify text-only posts first.
- Then test media.

### LinkedIn organization
- Make sure your personal account is an **admin** or otherwise allowed role on the organization page.
- Connect the organization account using the org URN.
- Publish text first.

### Facebook Page
- Use a real Page you administer.
- Verify the Page access token works.
- Start with `/feed` text posts.

### Instagram
- Use a real professional IG account linked to the Page.
- Start with one image.
- Then test reels/carousels after basic posting works.

## Common failure points

- Missing or expired access tokens.
- Wrong LinkedIn role for organization posting.
- Using a Facebook user token instead of a Page token.
- Instagram account not being professional.
- Instagram account not linked to a Facebook Page.
- Missing app review / business verification / permission approval.
- Media URLs not publicly reachable for Instagram container creation.

## Best implementation pattern

1. Build the compose UI.
2. Build account connection screens per platform.
3. Store tokens encrypted.
4. Publish through a queue worker, not directly in the request.
5. Save results and retry failures.
6. Add per-platform preview and validation.

## What to implement first

- Text-only LinkedIn personal post
- Text-only LinkedIn organization post
- Facebook Page text post
- Instagram image post
- Then add media uploads, scheduling, retries, and logs

## Production notes

- Never store tokens in plain text.
- Log request IDs and platform error responses.
- Add rate limiting.
- Add idempotency keys for your publish jobs.
- Separate UI state from publish execution.
- Expect platform permissions and app review to be the real bottleneck.

## Sources used

- LinkedIn Posts API and permissions: Microsoft Learn, LinkedIn Posts API.
- LinkedIn organization role access: Microsoft Learn, Organization Access Control by Role.
- Facebook Pages posting: Meta Developers, Pages API / Pages Posts docs.
- Instagram publishing: Meta Developers, Instagram Content Publishing docs.

