/**
 * Blog Agent Orchestrator
 *
 * The core pipeline that generates a daily personalized blog post:
 *   1. Agent Loop — Groq acts autonomously, deciding to call Tavily, evaluate trends, and write the blog.
 *   2. Visualize  — Gemini generates a banner image using the agent's prompt.
 *   3. Persist    — Image uploaded to storage, blog saved to MongoDB.
 */

import { runAgenticBlogGeneration } from "./groq";
import { generateBlogImage } from "./gemini";
import { uploadImageBuffer } from "@/lib/ai/upload-helper";
import GeneratedBlog, { IGeneratedBlog } from "@/models/GeneratedBlog";
import connectDB from "@/lib/db/mongoose";

export interface AgentRunResult {
  success: boolean;
  blog?: IGeneratedBlog;
  steps: AgentStep[];
  error?: string;
}

export interface AgentStep {
  name: string;
  status: "success" | "failed" | "skipped";
  detail?: string;
  durationMs?: number;
}

/**
 * Run the full blog generation pipeline.
 */
export async function generateDailyBlog(trendContext?: string, trendTitle?: string): Promise<AgentRunResult> {
  const steps: AgentStep[] = [];
  let topic = "";
  let trendQuery = "";
  let title = "";
  let content = "";
  let imagePrompt = "";
  let imageUrl = "";

  /* ── Step 1: Agentic Loop (Research + Topic + Writing) ── */
  const t1 = Date.now();
  try {
    const agentResult = await runAgenticBlogGeneration((msg) => {
      // We log sub-steps from the agent into the frontend steps array
      steps.push({
        name: "Agent Thought",
        status: "success",
        detail: msg,
      });
    }, trendContext, trendTitle);

    topic = agentResult.topic;
    trendQuery = agentResult.trendQuery;
    title = agentResult.title;
    content = agentResult.content;
    imagePrompt = agentResult.imagePrompt;

    steps.push({
      name: "Agentic Generation",
      status: "success",
      detail: `Generated "${title}" (${content.length} chars) under '${topic}'`,
      durationMs: Date.now() - t1,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    steps.push({
      name: "Agentic Generation",
      status: "failed",
      detail: msg,
      durationMs: Date.now() - t1,
    });
    return { success: false, steps, error: `Agentic generation failed: ${msg}` };
  }

  /* ── Step 2: Image Generation via Gemini ── */
  const t2 = Date.now();
  try {
    const imageResult = await generateBlogImage(imagePrompt);

    if (imageResult) {
      imageUrl = await uploadImageBuffer(imageResult.buffer, imageResult.mimeType);

      steps.push({
        name: "Image Generation",
        status: "success",
        detail: `Image generated and uploaded`,
        durationMs: Date.now() - t2,
      });
    } else {
      steps.push({
        name: "Image Generation",
        status: "skipped",
        detail: "Imagen 3 unavailable. Blog saved without banner.",
        durationMs: Date.now() - t2,
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    steps.push({
      name: "Image Generation",
      status: "skipped",
      detail: `Image generation failed (non-blocking): ${msg}`,
      durationMs: Date.now() - t2,
    });
  }

  /* ── Step 3: Persist to MongoDB ── */
  const t3 = Date.now();
  try {
    await connectDB();

    const blog = await GeneratedBlog.create({
      topic,
      trendQuery,
      title,
      content,
      imagePrompt,
      imageUrl,
      status: "draft",
    });

    steps.push({
      name: "Save to Database",
      status: "success",
      detail: `Blog ID: ${blog._id}`,
      durationMs: Date.now() - t3,
    });

    return { success: true, blog, steps };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    steps.push({
      name: "Save to Database",
      status: "failed",
      detail: msg,
      durationMs: Date.now() - t3,
    });
    return { success: false, steps, error: `Database save failed: ${msg}` };
  }
}
