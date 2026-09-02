import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getEconomicCalendar } from "@/lib/economic-calendar/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "Authentication required.",
        },
        { status: 401 },
      );
    }

    const data =
      await getEconomicCalendar();

    return NextResponse.json({
      data,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith(
        "FOREX_FACTORY_RATE_LIMIT",
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Economic Calendar source is temporarily rate limited. Cached data will be used when available.",
          code: "FOREX_FACTORY_RATE_LIMIT",
        },
        { status: 503 },
      );
    }

    console.error(
      "GET /api/economic-calendar failed:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to load Economic Calendar.",
      },
      { status: 500 },
    );
  }
}
