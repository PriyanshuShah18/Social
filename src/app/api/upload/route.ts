import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Generate a unique filename
    const uniqueId = crypto.randomBytes(8).toString("hex");
    const extension = file.name.split('.').pop() || 'png';
    const filename = `${uniqueId}.${extension}`;

    // Check if S3 is configured
    const s3Bucket = process.env.AWS_S3_BUCKET;
    const s3Region = process.env.AWS_S3_REGION;
    const s3AccessKey = process.env.AWS_ACCESS_KEY_ID;
    const s3Secret = process.env.AWS_SECRET_ACCESS_KEY;
    const s3Endpoint = process.env.AWS_S3_ENDPOINT;

    // Use S3 if credentials are provided and not "placeholder"
    if (s3Bucket && s3Region && s3AccessKey && s3AccessKey !== "placeholder" && s3Secret && s3Secret !== "placeholder") {
      const s3Client = new S3Client({
        region: s3Region,
        credentials: {
          accessKeyId: s3AccessKey,
          secretAccessKey: s3Secret,
        },
        endpoint: s3Endpoint || undefined,
        // R2 often requires forcePathStyle if no custom domain is set up
      });

      await s3Client.send(
        new PutObjectCommand({
          Bucket: s3Bucket,
          Key: filename,
          Body: buffer,
          ContentType: file.type,
          // ACL: "public-read", // Sometimes required depending on bucket settings
        })
      );

      // Construct public URL
      let publicUrl;
      if (s3Endpoint && s3Endpoint.includes('r2.cloudflarestorage.com')) {
         // Cloudflare R2 requires a custom domain for public access, but we'll try to guess it
         // Or just return the path style if public bucket
         const url = new URL(s3Endpoint);
         publicUrl = `${url.protocol}//${url.host}/${s3Bucket}/${filename}`;
      } else if (s3Endpoint) {
         const url = new URL(s3Endpoint);
         publicUrl = `${url.protocol}//${url.host}/${s3Bucket}/${filename}`;
      } else {
        // Standard AWS S3 URL
        publicUrl = `https://${s3Bucket}.s3.${s3Region}.amazonaws.com/${filename}`;
      }

      return NextResponse.json({ url: publicUrl });

    } else {
      // Fallback: Local Storage
      const uploadDir = join(process.cwd(), "public", "uploads");
      
      // Ensure directory exists
      try {
        await mkdir(uploadDir, { recursive: true });
      } catch (err) {
        // ignore if exists
      }

      const filePath = join(uploadDir, filename);
      await writeFile(filePath, buffer);

      // Return local URL using APP_URL
      // NOTE: APP_URL must be a public ngrok URL for Meta to download the image
      let appUrl = process.env.APP_URL || "http://localhost:3000";
      if (appUrl.endsWith('/')) {
        appUrl = appUrl.slice(0, -1);
      }
      const publicUrl = `${appUrl}/uploads/${filename}`;

      return NextResponse.json({ url: publicUrl });
    }
  } catch (error: unknown) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
