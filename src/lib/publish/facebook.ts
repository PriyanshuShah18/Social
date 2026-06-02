import axios from "axios";

interface FacebookPublishParams {
  pageId: string;
  pageAccessToken: string;
  text: string;
  link?: string;
  mediaUrls?: string[];
}

/**
 * Publish a text (and optional link or photo) post to a Facebook Page.
 * Uses the Graph API /{page-id}/feed or /{page-id}/photos endpoint.
 *
 * Returns the platform post ID.
 */
export async function publishFacebookPagePost(
  params: FacebookPublishParams
): Promise<string> {
  const version = process.env.META_GRAPH_VERSION || "v25.0";

  const requestParams: Record<string, string> = {
    message: params.text,
    access_token: params.pageAccessToken,
  };

  const hasMedia = params.mediaUrls && params.mediaUrls.length > 0;

  if (params.link) {
    const isLocalhost = params.link.includes('localhost') || params.link.includes('127.0.0.1');
    
    if (hasMedia || isLocalhost) {
      // The /photos endpoint doesn't support a 'link' attachment.
      // Also, Facebook's crawler strictly rejects 'localhost' URLs if passed in the 'link' parameter.
      // In both cases, we safely append the link to the message body.
      requestParams.message += `\n\n🔗 Read the full article here:\n${params.link}`;
    } else {
      requestParams.link = params.link;
    }
  }

  let endpoint = `https://graph.facebook.com/${version}/${params.pageId}/feed`;
  
  if (hasMedia) {
    endpoint = `https://graph.facebook.com/${version}/${params.pageId}/photos`;
    requestParams.url = params.mediaUrls![0];
  }

  const res = await axios.post(
    endpoint,
    null,
    { params: requestParams }
  );

  return (res.data.post_id || res.data.id) as string;
}
