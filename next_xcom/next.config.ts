import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/notes/files", destination: "/api/notes/files" },
      { source: "/notes/content", destination: "/api/notes/content" },
      { source: "/notes/progress/reset", destination: "/api/notes/progress/reset" },
      { source: "/entries", destination: "/api/entries" },
      { source: "/entries/:path*", destination: "/api/entries/:path*" },
      { source: "/save", destination: "/api/save" },
      { source: "/llm/status", destination: "/api/llm/status" },
      { source: "/generate", destination: "/api/generate" },
      { source: "/generate-from-notes", destination: "/api/generate-from-notes" },
      {
        source: "/generate-from-notes/status/:jobId",
        destination: "/api/generate-from-notes/status/:jobId",
      },
    ];
  },
};

export default nextConfig;
