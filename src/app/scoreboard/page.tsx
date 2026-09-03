import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { canAccessCreatorTools } from "@/lib/auth/roles";
import { ScoreboardSettings } from "@/components/scoreboard/ScoreboardSettings";
import styles from "./ScoreboardPage.module.css";

export default async function ScoreboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=/scoreboard");
  }

  if (!canAccessCreatorTools(user)) {
    redirect("/dashboard");
  }

  return (
    <>
      <div className={styles.creatorTools}>
        <Link href="/creator/episodes">OPEN EPISODE BUILDER →</Link>
      </div>
      <ScoreboardSettings />
    </>
  );
}
