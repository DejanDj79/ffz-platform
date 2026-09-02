import { ScoreboardOverlay } from "@/components/scoreboard/ScoreboardOverlay";

type PageProps = {
  params: Promise<{ key: string }>;
};

export default async function ScoreboardOverlayPage({
  params,
}: PageProps) {
  const { key } = await params;

  return <ScoreboardOverlay overlayKey={key} />;
}
