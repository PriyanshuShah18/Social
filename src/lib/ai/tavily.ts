/**
 * Tavily Search API Wrapper
 *
 * Searches for current market trends in IT, automation, and business domains.
 * Uses Tavily's REST API via axios (no SDK needed).
 */

import axios from "axios";

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const TAVILY_SEARCH_URL = "https://api.tavily.com/search";

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export interface TavilySearchResponse {
  results: TavilyResult[];
  query: string;
}

/**
 * Search Tavily for recent market trends related to our core topics.
 * Returns the top results with titles and content snippets.
 */
export async function searchMarketTrends(): Promise<TavilySearchResponse> {
  if (!TAVILY_API_KEY) {
    throw new Error(
      "TAVILY_API_KEY is not set. Add it to your .env.local file."
    );
  }

  const coreCategories = [
    "IT Technology",
    "Business Process Automation",
    Math.random() > 0.5 ? "Enterprise Resource Planning (ERP)" : "Human Resource Management Systems (HRMS)",
    "Customer Relationship Management (CRM)",
    "Brand Awareness Strategy"
  ];

  const results: TavilyResult[] = [];
  const seenUrls = new Set<string>();

  // Fetch exactly 1 top result for each distinct category to guarantee a perfect mix
  for (const category of coreCategories) {
    const categoryQuery = `Latest breaking news and emerging trends for ${category} specifically impacting the IT Sector, AI, and Software Services`;
    
    try {
      // Attempt 1: Strict 24-hour news
      let response = await axios.post(
        TAVILY_SEARCH_URL,
        {
          query: categoryQuery,
          search_depth: "advanced",
          topic: "news",
          days: 1, // Restrict strictly to the last 24 hours
          max_results: 5,
          include_answer: false,
          include_raw_content: false,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${TAVILY_API_KEY}`,
          },
          timeout: 10000,
        }
      );

      let categoryResults = response.data.results || [];

      // Fallback 1: Relax time constraint
      if (categoryResults.length === 0) {
        response = await axios.post(
          TAVILY_SEARCH_URL,
          {
            query: `Top market trends for ${category}`,
            search_depth: "advanced",
            topic: "general", 
            max_results: 5,
            include_answer: false,
            include_raw_content: false,
          },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${TAVILY_API_KEY}`,
            },
            timeout: 10000,
          }
        );
        categoryResults = response.data.results || [];
      }

      // Fallback 2: Absolute generic fallback if the API is returning nothing for this category
      if (categoryResults.length === 0) {
        response = await axios.post(
          TAVILY_SEARCH_URL,
          {
            query: `Latest business technology news`,
            search_depth: "basic",
            max_results: 5,
          },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${TAVILY_API_KEY}`,
            },
            timeout: 10000,
          }
        );
        categoryResults = response.data.results || [];
      }

      if (categoryResults.length > 0) {
        // Sort by score to get the best one
        categoryResults.sort((a: any, b: any) => b.score - a.score);
        
        let best = null;
        for (const res of categoryResults) {
          if (!seenUrls.has(res.url)) {
            best = res;
            break;
          }
        }

        if (best) {
          seenUrls.add(best.url);
          // Clean title to remove publisher names (e.g., "Trend - Forbes" or "Trend | NYT")
          const cleanTitle = best.title.replace(/\s*[-|]\s*(?!.*[-|]).*$/, '').trim();

          results.push({
            title: cleanTitle,
            url: best.url,
            content: best.content,
            score: best.score,
          });
        } else {
          // If all 5 were duplicates, fallback to hardcoded
          throw new Error("All returned results were duplicates");
        }
      }
    } catch (err) {
      console.error(`[tavily] Error fetching trend for ${category}:`, err);
      // Hardcoded ultimate fallback to guarantee exactly 5 items if the network fails completely
      results.push({
        title: `The Future of ${category} in 2026`,
        url: "#",
        content: `Exploring how modern AI and automation are redefining ${category}.`,
        score: 0.5
      });
    }
  }

  return {
    results,
    query: "Mixed distinct topics",
  };
}
