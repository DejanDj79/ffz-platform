import { sql as drizzleSql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(drizzleSql`select 1`);

    return NextResponse.json({
      ok: true,
      database: "connected",
    });
  } catch (error) {
    console.error("Database health check failed:", error);

    return NextResponse.json(
      {
        ok: false,
        database: "unavailable",
      },
      { status: 503 },
    );
  }
}
