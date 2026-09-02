import type { AuthUser } from "./types";

export function canAccessCreatorTools(
  user: Pick<AuthUser, "role"> | null | undefined,
) {
  return user?.role === "CREATOR";
}
