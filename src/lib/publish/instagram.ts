import axios from "axios";

interface InstagramContainerParams {
  igUserId: string;
  accessToken: string;
  imageUrl: string;
  caption: string;
}

interface InstagramPublishParams {
  igUserId: string;
  accessToken: string;
  creationId: string;
}

/**
 * Step 1: Create an Instagram media container for a single image.
 * The imageUrl must be publicly accessible.
 *
 * Returns the container (creation) ID.
 */
export async function createInstagramImageContainer(
  params: InstagramContainerParams
): Promise<string> {
  const version = process.env.META_GRAPH_VERSION || "v25.0";

  const res = await axios.post(
    `https://graph.facebook.com/${version}/${params.igUserId}/media`,
    null,
    {
      params: {
        image_url: params.imageUrl,
        caption: params.caption,
        access_token: params.accessToken,
      },
    }
  );

  return res.data.id as string;
}

/**
 * Step 2: Publish a previously created Instagram media container.
 *
 * Returns the published media ID.
 */
export async function publishInstagramContainer(
  params: InstagramPublishParams
): Promise<string> {
  const version = process.env.META_GRAPH_VERSION || "v25.0";

  const res = await axios.post(
    `https://graph.facebook.com/${version}/${params.igUserId}/media_publish`,
    null,
    {
      params: {
        creation_id: params.creationId,
        access_token: params.accessToken,
      },
    }
  );

  return res.data.id as string;
}
