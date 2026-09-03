import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import {
  getTradingGuardrailSettings,
  saveTradingGuardrailSettings,
} from "@/lib/trading/guardrails-repository";
import { tradingGuardrailSettingsSchema } from "@/lib/trading/guardrails-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    return NextResponse.json({
      data: await getTradingGuardrailSettings(user.id),
    });
  } catch (error) {
    console.error("GET /api/trading-guardrails failed:", error);
    return NextResponse.json(
      { error: "Unable to load trading guardrails." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const input = tradingGuardrailSettingsSchema.parse(await request.json());
    return NextResponse.json({
      data: await saveTradingGuardrailSettings(user.id, input),
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid trading guardrail settings.", issues: error.issues },
        { status: 400 },
      );
    }

    console.error("PUT /api/trading-guardrails failed:", error);
    return NextResponse.json(
      { error: "Unable to save trading guardrails." },
      { status: 500 },
    );
  }
}
