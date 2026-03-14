import { NextRequest, NextResponse } from "next/server";
import {
  isInitialized,
  generateText,
  enhanceText,
  summarizeText,
  expandText,
} from "@/lib/llm";

export async function POST(request: NextRequest) {
  if (!isInitialized()) {
    return NextResponse.json(
      {
        error:
          "LLM not configured. Set XAI_API_KEY environment variable to enable AI features.",
      },
      { status: 503 }
    );
  }
  let body: { prompt?: string; action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { prompt, action = "generate" } = body;
  if (!prompt || prompt.trim().length === 0) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }
  try {
    let result;
    switch (action) {
      case "enhance":
        result = await enhanceText(prompt);
        break;
      case "summarize":
        result = await summarizeText(prompt);
        break;
      case "expand":
        result = await expandText(prompt);
        break;
      case "generate":
      default:
        result = await generateText(
          prompt.trim() ||
            "Write an interesting, engaging short thought or observation under 280 characters"
        );
        break;
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("Generate error:", (error as Error).message);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
