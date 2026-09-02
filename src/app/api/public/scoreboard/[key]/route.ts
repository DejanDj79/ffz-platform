import { NextResponse } from "next/server";
import { buildPublicScoreboardData } from "@/lib/scoreboard/public-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ key: string }>;
};

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  try {
    const { key } = await context.params;
    const data = await buildPublicScoreboardData(key);

    if (!data) {
      return NextResponse.json(
        { error: "Scoreboard not found." },
        {
          status: 404,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    return NextResponse.json(
      { data },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    console.error("GET /api/public/scoreboard/[key] failed:", error);

    return NextResponse.json(
      { error: "Unable to load scoreboard." },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
