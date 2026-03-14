import { NextResponse } from "next/server";
import { isInitialized } from "@/lib/llm";

export async function GET() {
  return NextResponse.json({
    initialized: isInitialized(),
    message: isInitialized()
      ? "LLM is ready"
      : "LLM not configured. Set XAI_API_KEY environment variable.",
  });
}
