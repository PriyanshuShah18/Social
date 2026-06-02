# AI Social Posting Agent

An automated social media agent that researches daily market trends, generates highly targeted, SEO-friendly blogs with photorealistic AI images, and allows seamless publishing across multiple social channels.

## Key Features

- **Daily Trend Analysis:** Uses the Tavily API to fetch breaking news and trends specifically from the IT, CRM, Automation, and ERP sectors.
- **AI Content Generation:** Leverages Groq (Llama 3 / Mixtral) to write structured, engaging blog content based on the hottest trending topics.
- **AI Image Generation:** Generates photorealistic, hyper-relevant cover images using Hugging Face's Stable Diffusion pipeline with strict aesthetic constraints.
- **Multi-Channel Publishing:** Posts directly to Facebook Pages, Instagram, and LinkedIn (Personal/Company pages) via native Meta Graph and LinkedIn REST APIs.
- **Quick Compose Engine:** Automatically extracts cleanly formatted paragraphs from generated blogs and attaches appropriate metadata for swift cross-platform social posting.
- **Website CMS Integration:** Contains a "Publish to Website" workflow, ready to be hot-plugged into your company's WordPress, Webflow, or custom CMS.

## Tech Stack

- **Framework:** Next.js (App Router), React, TypeScript
- **Database:** MongoDB with Mongoose
- **Styling:** Vanilla CSS Modules
- **AI / Services:**
  - **Groq** (Fast LLM Inference)
  - **Hugging Face** (Image Generation)
  - **Tavily** (Live Web Search & Market Research)

## Setup & Installation

Please refer to the [CREDENTIALS_SETUP.md](./CREDENTIALS_SETUP.md) for the complete, step-by-step guide to generating your API keys and setting up the environment.

1. **Clone the repository.**
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Configure Environment Variables:**
   Create a `.env.local` file in the root directory with the keys outlined in the setup guide.
4. **Run the Development Server:**
   ```bash
   npm run dev
   ```
5. **Open your browser:** Navigate to `http://localhost:3000` to access the Social Media Dashboard.
