/**
 * Groq Text Generation Wrapper — Agentic Loop
 *
 * Uses the Groq SDK with Tool Calling (Function Calling) to let the LLM
 * autonomously search for market trends using Tavily, evaluate them,
 * and then write the final blog post and prompts.
 */

import Groq from "groq-sdk";
import { searchMarketTrends } from "./tavily";

let _client: Groq | null = null;

function getClient(): Groq {
  if (!_client) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GROQ_API_KEY is not set. Add it to your .env.local file."
      );
    }
    _client = new Groq({ apiKey });
  }
  return _client;
}

const MODEL = "llama-3.3-70b-versatile";

export interface BlogGenerationResult {
  topic: string;
  trendQuery: string;
  title: string;
  content: string;
  imagePrompt: string;
}

/**
 * Runs an agentic loop where Groq can call the 'search_market_trends' tool,
 * analyze the results, and generate the blog JSON payload.
 *
 * @param onStep Optional callback to report agent progress.
 * @param trendContext Optional string containing the trend to focus on.
 * @param trendTitle Optional string containing the title of the trend.
 */
export async function runAgenticBlogGeneration(
  onStep?: (msg: string) => void,
  trendContext?: string,
  trendTitle?: string
): Promise<BlogGenerationResult> {
  const client = getClient();

  const systemPrompt = `You are an autonomous AI content strategist and professional blog writer.
Your company focuses on 4 core topics:
1. IT & Technology
2. Brand Awareness
3. Automation Systems
4. ERP-CRM-HRMS

Your goal is to write a daily personalized blog post based on CURRENT market trends.
${!trendContext ? "You have access to a tool called 'search_market_trends' which searches the web for the latest news in these domains." : ""}

Workflow:
${!trendContext ? "1. Call 'search_market_trends' to get the latest trends." : "1. Analyze the provided market trend."}
2. Select the single most relevant topic category from the 4 above based on what you found or were provided.
3. Write a 600-800 word blog post with a specific title, professional tone, and actionable insights (using markdown).
4. Generate a detailed prompt for an image generator to create a professional blog banner image. CRITICAL IMAGE RULES: 
   - RELEVANCE: The visual elements MUST directly illustrate the specific topic of the blog (e.g., if the blog is about Cloud AI, show cloud/data concepts; if it's about CRM, show client relationships or sleek analytics). DO NOT default to generic boardroom meetings.
   - STYLE: Describe a "photorealistic 8k highly detailed photograph shot on a DSLR with pin-point precision". It must look like a real, high-end stock photograph with flawless rendering.
   - BANNED: ABSOLUTELY NO illustrations, cartoons, painterly styles, glowing brains, neon holograms, floating text, or morphed geometry.
   - HUMAN ANATOMY (CRITICAL): If humans are included, they MUST be fully formed with complete, anatomically correct bodies, visible heads, and flawless facial features. ABSOLUTELY NO missing heads, decapitations, mangled limbs, or messy AI artifacts. Everything must be detailed to pin-point precision and nothing less.

When outputting the final result, you MUST respond in valid JSON matching this exact structure:
{
  "topic": "<one of the 4 core topics>",
  "trendQuery": "<a brief summary of the exact trends/news you based this blog on>",
  "title": "<blog post title>",
  "content": "<full blog post in markdown format>",
  "imagePrompt": "<detailed prompt for generating the banner image following the critical rules above>"
}`;

  const userPrompt = trendContext 
    ? `Please generate today's blog post based on this specific market trend:\nTitle: ${trendTitle}\nContext: ${trendContext}`
    : "Please generate today's blog post by first searching the market trends.";

  const messages: any[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  onStep?.("Initializing Groq agent...");

  const tools = !trendContext ? [
    {
      type: "function" as const,
      function: {
        name: "search_market_trends",
        description:
          "Searches the web via Tavily for the latest market trends related to IT, Brand Awareness, Automation, and ERP.",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },
    },
  ] : undefined;

  // Step 1: LLM decides whether to call tools
  const response1 = await client.chat.completions.create({
    model: MODEL,
    messages,
    tools: tools,
    tool_choice: tools ? "auto" : "none",
    temperature: 0.2, // low temp for reliable tool calling
  });

  const msg1 = response1.choices[0].message;
  messages.push(msg1);

  // Check if the agent called a tool
  if (msg1.tool_calls && msg1.tool_calls.length > 0) {
    const toolCall = msg1.tool_calls[0];
    if (toolCall.function.name === "search_market_trends") {
      onStep?.("Agent autonomously invoked tool: search_market_trends");
      
      const trends = await searchMarketTrends();
      const summaries = trends.results
        .map((r, i) => `${i + 1}. Title: ${r.title}\nContent: ${r.content}\nSource: ${r.url}`)
        .join("\n\n");

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        name: toolCall.function.name,
        content: summaries,
      });
      
      onStep?.(`Tool returned ${trends.results.length} trends. Agent is writing the blog...`);
    }
  } else {
    onStep?.("Agent decided to skip tool calling (using internal knowledge). Writing blog...");
  }

  // Step 2: Final response forced to JSON
  const response2 = await client.chat.completions.create({
    model: MODEL,
    messages,
    response_format: { type: "json_object" },
    temperature: 0.7, // higher temp for creative writing
  });

  const finalContent = response2.choices[0].message.content;
  if (!finalContent) {
    throw new Error("Groq returned an empty response during final generation.");
  }

  const parsed = JSON.parse(finalContent) as BlogGenerationResult;

  // Validate topic fallback
  const validTopics = [
    "IT & Technology",
    "Brand Awareness",
    "Automation Systems",
    "ERP-CRM-HRMS",
  ];
  if (!validTopics.includes(parsed.topic)) {
    parsed.topic = "IT & Technology";
  }

  return parsed;
}
