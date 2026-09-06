import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { hasEntitlement } from "@/lib/monetization/entitlements";
import { DEFAULT_TRADING_GUARDRAILS } from "@/lib/trading/guardrails";
import {
  getTradingGuardrailSettings,
  saveTradingGuardrailSettings,
} from "@/lib/trading/guardrails-repository";
import { tradingGuardrailSettingsSchema } from "@/lib/trading/guardrails-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function freeGuardrailSettings() {
  return {
    ...DEFAULT_TRADING_GUARDRAILS,
    maxRiskPerTrade: { ...DEFAULT_TRADING_GUARDRAILS.maxRiskPerTrade, enabled: false },
    maxDailyLosses: { ...DEFAULT_TRADING_GUARDRAILS.maxDailyLosses, enabled: false },
    maxTradesPerDay: { ...DEFAULT_TRADING_GUARDRAILS.maxTradesPerDay, enabled: false },
    maxContracts: { ...DEFAULT_TRADING_GUARDRAILS.maxContracts, enabled: false },
    minRewardRisk: { ...DEFAULT_TRADING_GUARDRAILS.minRewardRisk, enabled: false },
    noNewTradesAfter: { ...DEFAULT_TRADING_GUARDRAILS.noNewTradesAfter, enabled: false },
    highImpactNews: { ...DEFAULT_TRADING_GUARDRAILS.highImpactNews, enabled: false },
    mediumImpactNews: { ...DEFAULT_TRADING_GUARDRAILS.mediumImpactNews, enabled: false },
    majorNewsOverride: { ...DEFAULT_TRADING_GUARDRAILS.majorNewsOverride, enabled: false },
    id: null,
    createdAt: null,
    updatedAt: null,
  };
}

function proRequiredResponse() {
  return NextResponse.json(
    {
      error: "Trading Guardrails and news lockout require FFZ Pro.",
      code: "PRO_REQUIRED",
      upgradeUrl: "/upgrade?from=%2Ftools%2Ftrading-guardrails&feature=Personal+Trading+Guardrails",
    },
    { status: 403 },
  );
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!hasEntitlement(user.plan, "TRADING_GUARDRAILS")) {
      return NextResponse.json({ data: freeGuardrailSettings() });
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

    if (!hasEntitlement(user.plan, "TRADING_GUARDRAILS")) {
      return proRequiredResponse();
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
