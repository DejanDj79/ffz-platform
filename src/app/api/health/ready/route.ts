import { NextResponse } from "next/server";
import { sql } from "@/db/client";
import {
  productionEnvironmentIssues,
} from "@/lib/env/server";
import {
  ensureImageStorageReady,
} from "@/lib/storage/image-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const checks = {
    environment: false,
    database: false,
    uploads: false,
  };

  const issues =
    productionEnvironmentIssues();

  checks.environment =
    issues.length === 0;

  try {
    await sql`select 1 as ready`;
    checks.database = true;
  } catch (error) {
    console.error(
      "FFZ readiness database check failed:",
      error,
    );
  }

  try {
    await ensureImageStorageReady();
    checks.uploads = true;
  } catch (error) {
    console.error(
      "FFZ readiness upload storage check failed:",
      error,
    );
  }

  const ready =
    Object.values(checks).every(Boolean);

  return NextResponse.json(
    {
      status: ready
        ? "ready"
        : "not_ready",
      checks,
      issues,
    },
    {
      status: ready ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
