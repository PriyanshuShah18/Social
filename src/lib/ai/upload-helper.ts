/**
 * Image Upload Helper
 *
 * Uploads a raw image buffer to S3 or local storage.
 * Reuses the same S3/local fallback pattern as the existing /api/upload route.
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import crypto from "crypto";

/**
 * Upload an image buffer to storage and return a public URL.
 * If S3 is configured, uploads there. Otherwise, saves to public/uploads/.
 */
export async function uploadImageBuffer(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const uniqueId = crypto.randomBytes(8).toString("hex");
  const ext = mimeType === "image/jpeg" ? "jpg" : "png";
  const filename = `blog-${uniqueId}.${ext}`;

  const s3Bucket = process.env.AWS_S3_BUCKET;
  const s3Region = process.env.AWS_S3_REGION;
  const s3AccessKey = process.env.AWS_ACCESS_KEY_ID;
  const s3Secret = process.env.AWS_SECRET_ACCESS_KEY;
  const s3Endpoint = process.env.AWS_S3_ENDPOINT;

  // ── S3 Upload ──
  if (
    s3Bucket &&
    s3Region &&
    s3AccessKey &&
    s3AccessKey !== "placeholder" &&
    s3Secret &&
    s3Secret !== "placeholder"
  ) {
    const s3Client = new S3Client({
      region: s3Region,
      credentials: {
        accessKeyId: s3AccessKey,
        secretAccessKey: s3Secret,
      },
      endpoint: s3Endpoint || undefined,
    });

    await s3Client.send(
      new PutObjectCommand({
        Bucket: s3Bucket,
        Key: `ai-blogs/${filename}`,
        Body: buffer,
        ContentType: mimeType,
      })
    );

    if (s3Endpoint) {
      const url = new URL(s3Endpoint);
      return `${url.protocol}//${url.host}/${s3Bucket}/ai-blogs/${filename}`;
    }
    return `https://${s3Bucket}.s3.${s3Region}.amazonaws.com/ai-blogs/${filename}`;
  }

  // ── Free Public Image Hosting Fallback (Catbox.moe) ──
  // We use this instead of local hosting so that Instagram Graph API
  // can download the image without hitting the ngrok interstitial warning.
  console.log("[upload-helper] S3 not configured. Uploading to public host (catbox.moe)...");
  try {
    const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
    const formData = new FormData();
    formData.append("reqtype", "fileupload");
    formData.append("fileToUpload", blob, filename);
    
    const response = await fetch("https://catbox.moe/user/api.php", {
      method: "POST",
      body: formData,
    });
    
    if (response.ok) {
      const publicUrl = (await response.text()).trim();
      console.log(`[upload-helper] Uploaded publicly to ${publicUrl}`);
      return publicUrl;
    } else {
      console.warn(`[upload-helper] Catbox upload failed with status ${response.status}`);
    }
  } catch (err) {
    console.error("[upload-helper] Public upload failed. Falling back to local storage.", err);
  }

  // ── Local Fallback ──
  const uploadDir = join(process.cwd(), "public", "uploads", "ai-blogs");
  try {
    await mkdir(uploadDir, { recursive: true });
  } catch {
    // directory already exists
  }

  const filePath = join(uploadDir, filename);
  await writeFile(filePath, buffer);

  let appUrl = process.env.APP_URL || "http://localhost:3000";
  if (appUrl.endsWith("/")) appUrl = appUrl.slice(0, -1);

  return `${appUrl}/uploads/ai-blogs/${filename}`;
}
