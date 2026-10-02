import { NextResponse } from "next/server";
import { SAMPLE_CSV } from "@/lib/csv";

export async function GET() {
  return new NextResponse(SAMPLE_CSV, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="chazmaster-template.csv"',
    },
  });
}
