import type { UserPlan } from "@/lib/monetization/types";

export type UserRole = "USER" | "CREATOR";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  plan: UserPlan;
};
