import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { canAccessCreatorTools } from "@/lib/auth/roles";
import { ScoreboardSettings } from "@/components/scoreboard/ScoreboardSettings";

export default async function ScoreboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=/scoreboard");
  }

  if (!canAccessCreatorTools(user)) {
    redirect("/dashboard");
  }

  return <ScoreboardSettings />;
}
