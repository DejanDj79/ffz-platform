import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import {
  deleteCustomRulePreset,
  getCustomRulePreset,
  updateCustomRulePreset,
} from "@/lib/prop-firms/custom-repository";
import { customRulePresetUpdateSchema } from "@/lib/prop-firms/custom-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { id } = await context.params;
    const data = await getCustomRulePreset(user.id, id);
    if (!data) return NextResponse.json({ error: "Custom preset not found." }, { status: 404 });
    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/prop-firm-rules/custom/[id] failed:", error);
    return NextResponse.json({ error: "Unable to load custom preset." }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { id } = await context.params;
    const input = customRulePresetUpdateSchema.parse(await request.json());
    const data = await updateCustomRulePreset(user.id, id, input);
    if (!data) return NextResponse.json({ error: "Custom preset not found." }, { status: 404 });
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid custom preset data.", issues: error.issues }, { status: 400 });
    }
    console.error("PATCH /api/prop-firm-rules/custom/[id] failed:", error);
    return NextResponse.json({ error: "Unable to update custom preset." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { id } = await context.params;
    const data = await deleteCustomRulePreset(user.id, id);
    if (!data) return NextResponse.json({ error: "Custom preset not found." }, { status: 404 });
    return NextResponse.json({ data });
  } catch (error) {
    console.error("DELETE /api/prop-firm-rules/custom/[id] failed:", error);
    return NextResponse.json({ error: "Unable to delete custom preset." }, { status: 500 });
  }
}
