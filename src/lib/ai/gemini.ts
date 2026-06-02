/**
 * Image Generation Wrapper
 *
 * Uses Hugging Face Inference API (via the router endpoint) for high-quality images.
 * Falls back to Pollinations.ai (Flux model) if Hugging Face fails.
 */

export async function generateBlogImage(
  imagePrompt: string
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const seed = Math.floor(Math.random() * 1000000);
  const width = 1200;
  const height = 630;

  // ── 1. Try Hugging Face First ──
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (apiKey && apiKey !== "placeholder") {
    try {
      console.log("[image-gen] Fetching image from Hugging Face API...");
      const model = "black-forest-labs/FLUX.1-schnell";
      // Using the modern router endpoint to bypass DNS issues with api-inference
      const url = `https://router.huggingface.co/hf-inference/models/${model}`;
      
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: imagePrompt,
        }),
      });
      
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        return { buffer, mimeType: "image/jpeg" };
      } else {
        const errorText = await response.text();
        console.warn(`[image-gen] Hugging Face failed (${response.status}): ${errorText}`);
      }
    } catch (err: unknown) {
      console.error("[image-gen] Hugging Face network error:", err instanceof Error ? err.message : String(err));
    }
  } else {
    console.warn("[image-gen] No HUGGINGFACE_API_KEY found, skipping Hugging Face...");
  }

  // ── 2. Fallback to Pollinations ──
  try {
    console.log("[image-gen] Falling back to Pollinations.ai (Flux model)...");
    const encodedPrompt = encodeURIComponent(imagePrompt);
    const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${seed}&width=${width}&height=${height}&nologo=true&model=flux`;
    
    const response = await fetch(url);
    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return { buffer, mimeType: "image/jpeg" };
    } else {
      console.warn(`[image-gen] Pollinations failed (${response.status})`);
      return null;
    }
  } catch (err: unknown) {
    console.error("[image-gen] Pollinations network error:", err instanceof Error ? err.message : String(err));
    return null;
  }
}
