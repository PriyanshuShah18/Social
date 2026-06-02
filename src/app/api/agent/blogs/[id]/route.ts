/**
 * PUT  /api/agent/blogs/:id  — Update title/content (Edit)
 * DELETE /api/agent/blogs/:id  — Remove a blog
 */

import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import GeneratedBlog from "@/models/GeneratedBlog";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    await connectDB();

    const update: Record<string, unknown> = {};
    if (body.title !== undefined) update.title = body.title;
    if (body.content !== undefined) update.content = body.content;
    if (body.status !== undefined) update.status = body.status;

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const blog = await GeneratedBlog.findByIdAndUpdate(id, update, {
      new: true,
    });

    if (!blog) {
      return NextResponse.json({ error: "Blog not found" }, { status: 404 });
    }

    return NextResponse.json({ blog });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[agent/blogs/id] PUT Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    await connectDB();

    const blog = await GeneratedBlog.findByIdAndDelete(id);

    if (!blog) {
      return NextResponse.json({ error: "Blog not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[agent/blogs/id] DELETE Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
