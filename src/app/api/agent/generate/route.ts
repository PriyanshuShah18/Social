/**
 * POST /api/agent/generate
 *
 * Triggers the AI blog generation pipeline.
 * Returns the generated blog and step-by-step execution details.
 */

import { NextResponse } from "next/server";
import { generateDailyBlog } from "@/lib/ai/blog-agent";

export async function POST(req: Request) {
  try {
    let trendTitle;
    let trendContext;

    try {
      const body = await req.json();
      trendTitle = body.trendTitle;
      trendContext = body.trendContext;
    } catch {
      // Body might be empty or invalid JSON, ignore
    }

    const result = await generateDailyBlog(trendContext, trendTitle);

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error || "Blog generation failed",
          steps: result.steps,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      blog: result.blog,
      steps: result.steps,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[agent/generate] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
