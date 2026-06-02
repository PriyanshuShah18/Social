import { NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import PublishJob from "@/models/PublishJob";
import { publishToChannels } from "@/lib/publish/publishToChannels";
import type { ChannelTarget } from "@/lib/publish/publishToChannels";

/**
 * POST /api/publish
 * Create a publish job and execute it synchronously.
 */
export async function POST(request: Request) {
  try {
    await connectDB();

    const body = await request.json();
    const { text, link, mediaUrls, targets } = body;

    // Validation
    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'text' field" },
        { status: 400 }
      );
    }

    if (!Array.isArray(targets) || targets.length === 0) {
      return NextResponse.json(
        { error: "Missing or empty 'targets' array" },
        { status: 400 }
      );
    }

    // Validate each target has channel and accountId
    for (const t of targets) {
      if (!t.channel || !t.accountId) {
        return NextResponse.json(
          { error: "Each target must have 'channel' and 'accountId'" },
          { status: 400 }
        );
      }
    }

    // Create the job document
    const job = await PublishJob.create({
      text,
      link,
      mediaUrls: mediaUrls || [],
      channels: targets.map((t: ChannelTarget) => t.channel),
      status: "processing",
    });

    // Execute publishing synchronously
    const results = await publishToChannels({
      text,
      link,
      mediaUrls,
      targets,
    });

    // Determine overall status
    const allSuccess = results.every((r) => r.success);
    const allFailed = results.every((r) => !r.success);
    const status = allSuccess ? "success" : allFailed ? "failed" : "partial";

    // Update the job with results
    job.status = status;
    job.results = results.map((r) => ({
      channel: r.channel,
      success: r.success,
      platformPostId: r.platformPostId,
      error: r.error,
    }));
    await job.save();

    return NextResponse.json({
      jobId: job._id,
      status: job.status,
      results: job.results,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("Publish error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/publish?jobId=...
 * Retrieve a publish job's status and results.
 */
export async function GET(request: Request) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      // Return all jobs, most recent first
      const jobs = await PublishJob.find()
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
      return NextResponse.json({ jobs });
    }

    const job = await PublishJob.findById(jobId).lean();
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({ job });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
