import axios from "axios";

interface LinkedInPublishParams {
  accessToken: string;
  version: string;
  authorUrn: string; // urn:li:person:... or urn:li:organization:...
  text: string;
}

/**
 * Publish a text-only post to LinkedIn using the Posts API.
 * Works for both personal profiles and organization pages.
 *
 * Returns the platform post ID from the x-restli-id header.
 */
export async function publishLinkedInTextPost(
  params: LinkedInPublishParams
): Promise<string> {
  const res = await axios.post(
    "https://api.linkedin.com/rest/posts",
    {
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
    },
    {
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "X-Restli-Protocol-Version": "2.0.0",
        "Linkedin-Version": params.version,
        "Content-Type": "application/json",
      },
      // LinkedIn returns 201 with the post ID in the header
      validateStatus: (status) => status >= 200 && status < 300,
    }
  );

  // The post URN is in the x-restli-id header
  const postId = res.headers["x-restli-id"] || "";
  return postId;
}
