import { NextResponse } from "next/server";
import { searchMarketTrends } from "@/lib/ai/tavily";

export async function GET() {
  try {
    const trends = await searchMarketTrends();
    
    // Rank by score descending
    const rankedAndFiltered = trends.results
      .sort((a, b) => b.score - a.score);

    // Return the top 5 best matches
    return NextResponse.json({
      trends: rankedAndFiltered.slice(0, 5),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[agent/trends] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
