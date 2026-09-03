import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import {
  createCustomRulePreset,
  listCustomRulePresets,
} from "@/lib/prop-firms/custom-repository";
import { customRulePresetInputSchema } from "@/lib/prop-firms/custom-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const data = await listCustomRulePresets(user.id);
    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/prop-firm-rules/custom failed:", error);
    return NextResponse.json({ error: "Unable to load custom presets." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const input = customRulePresetInputSchema.parse(await request.json());
    const data = await createCustomRulePreset(user.id, input);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid custom preset data.", issues: error.issues }, { status: 400 });
    }
    console.error("POST /api/prop-firm-rules/custom failed:", error);
    return NextResponse.json({ error: "Unable to create custom preset." }, { status: 500 });
  }
}
