import { WeeklyReview } from "@/components/journal/WeeklyReview";
import { getCurrentUser } from "@/lib/auth/session";
import { canAccessCreatorTools } from "@/lib/auth/roles";

export default async function WeeklyReviewPage() {
  const user = await getCurrentUser();
  return <WeeklyReview creatorMode={canAccessCreatorTools(user)} />;
}
