import { publishLinkedInTextPost } from "./linkedin";
import { publishFacebookPagePost } from "./facebook";
import {
  createInstagramImageContainer,
  publishInstagramContainer,
} from "./instagram";
import { decrypt } from "../encryption";
import ConnectedAccount from "@/models/ConnectedAccount";
import connectDB from "@/lib/db/mongoose";

export type ChannelType =
  | "linkedin_org"
  | "linkedin_personal"
  | "facebook_page"
  | "instagram";

export interface ChannelTarget {
  channel: ChannelType;
  accountId: string;
}

export interface PublishInput {
  text: string;
  link?: string;
  mediaUrls?: string[];
  targets: ChannelTarget[];
}

export interface PublishResult {
  channel: string;
  success: boolean;
  platformPostId?: string;
  error?: string;
  accountId?: string;
}

/**
 * Publish content to multiple social channels.
 * Iterates through each target, decrypts the stored token, and calls the
 * appropriate platform adapter.
 */
export async function publishToChannels(
  input: PublishInput
): Promise<PublishResult[]> {
  await connectDB();
  const results: PublishResult[] = [];

  for (const target of input.targets) {
    try {
      const account = await ConnectedAccount.findById(target.accountId);
      if (!account) {
        results.push({
          channel: target.channel,
          success: false,
          error: `Account ${target.accountId} not found`,
          accountId: target.accountId,
        });
        continue;
      }

      // Decrypt the stored access token
      const accessToken = decrypt(account.accessToken);

      // LinkedIn and Instagram do not natively support a 'link' attachment field.
      // So if a link is provided, we manually append it to the caption text for them.
      let platformText = input.text;
      if (input.link && target.channel !== "facebook_page") {
        platformText += `\n\n🔗 Read the full article here:\n${input.link}`;
      }

      // ── LinkedIn (personal or org) ──
      if (
        target.channel === "linkedin_org" ||
        target.channel === "linkedin_personal"
      ) {
        const postId = await publishLinkedInTextPost({
          accessToken,
          version: process.env.LINKEDIN_API_VERSION || "202606",
          authorUrn: account.externalAccountId,
          text: platformText,
        });
        results.push({
          channel: target.channel,
          success: true,
          platformPostId: postId,
          accountId: target.accountId,
        });
        continue;
      }

      // ── Facebook Page ──
      if (target.channel === "facebook_page") {
        const postId = await publishFacebookPagePost({
          pageId: account.externalAccountId,
          pageAccessToken: accessToken,
          text: input.text,
          link: input.link,
          mediaUrls: input.mediaUrls,
        });
        results.push({
          channel: target.channel,
          success: true,
          platformPostId: postId,
          accountId: target.accountId,
        });
        continue;
      }

      // ── Instagram ──
      if (target.channel === "instagram") {
        if (!input.mediaUrls?.length) {
          throw new Error("Instagram requires at least one media URL.");
        }

        const creationId = await createInstagramImageContainer({
          igUserId: account.externalAccountId,
          accessToken,
          imageUrl: input.mediaUrls[0],
          caption: platformText,
        });

        const postId = await publishInstagramContainer({
          igUserId: account.externalAccountId,
          accessToken,
          creationId,
        });

        results.push({
          channel: target.channel,
          success: true,
          platformPostId: postId,
          accountId: target.accountId,
        });
        continue;
      }

      // Unknown channel
      results.push({
        channel: target.channel,
        success: false,
        error: `Unknown channel: ${target.channel}`,
        accountId: target.accountId,
      });
    } catch (err: any) {
      let message = err instanceof Error ? err.message : "Unknown error";
      if (err.isAxiosError && err.response?.data?.error?.message) {
        message = `API Error: ${err.response.data.error.message}`;
      } else if (err.response?.data) {
        message = `API Error: ${JSON.stringify(err.response.data)}`;
      }
      
      results.push({
        channel: target.channel,
        success: false,
        error: message,
        accountId: target.accountId,
      });
    }
  }

  return results;
}
