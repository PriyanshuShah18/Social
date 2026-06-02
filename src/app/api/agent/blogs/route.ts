/**
 * GET /api/agent/blogs
 *
 * Returns all generated blogs, sorted by newest first.
 */

import { NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import GeneratedBlog from "@/models/GeneratedBlog";

export async function GET() {
  try {
    await connectDB();

    const blogs = await GeneratedBlog.find()
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ blogs });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[agent/blogs] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
