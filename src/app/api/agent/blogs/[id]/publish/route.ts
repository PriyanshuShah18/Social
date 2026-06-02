import { NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import GeneratedBlog from "@/models/GeneratedBlog";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectDB();
    const blog = await GeneratedBlog.findById(id);

    if (!blog) {
      return NextResponse.json({ error: "Blog not found" }, { status: 404 });
    }

    // ── MOCK CMS INTEGRATION ──
    // Here we would normally take blog.title, blog.content, blog.imageUrl
    // and POST it to a real CMS like WordPress, Webflow, or custom backend.
    
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Generate a mock published URL representing the company's live website
    const companyDomain = "https://yourcompany.com";
    // Create a slug from the title (lowercase, hyphenated, alphanumeric)
    const slug = blog.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
      
    const externalUrl = `${companyDomain}/blog/${slug}`;

    // Update blog status and save external URL
    blog.status = "published";
    blog.externalUrl = externalUrl;
    await blog.save();

    return NextResponse.json({ 
      success: true, 
      externalUrl 
    });
    
  } catch (error: any) {
    console.error("Website publish error:", error);
    return NextResponse.json(
      { error: "Failed to publish to website" },
      { status: 500 }
    );
  }
}
