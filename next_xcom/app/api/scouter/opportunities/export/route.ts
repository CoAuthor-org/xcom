import { NextResponse } from "next/server";
import { requireSupabaseStorage } from "@/lib/entries";
import { listOpportunities } from "@/lib/scouter/supabase";

function toCsv(rows: Array<{ domain: string; company_name: string; match_score: number }>) {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = ["domain,company_name,match_score"];
  for (const row of rows) {
    lines.push(`${escape(row.domain)},${escape(row.company_name)},${row.match_score}`);
  }
  return lines.join("\n");
}

export async function GET() {
  const err = requireSupabaseStorage();
  if (err) return NextResponse.json({ error: err.error }, { status: 503 });
  try {
    const items = await listOpportunities(1000);
    const active = items.filter((item) => item.status !== "ignored");
    const csv = toCsv(active);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="scouter-opportunity-domains.csv"`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
