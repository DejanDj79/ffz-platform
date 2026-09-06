import { ScoreboardOverlay } from "@/components/scoreboard/ScoreboardOverlay";

type PageProps = {
  params: Promise<{ key: string }>;
};

export default async function ScoreboardOverlayPage({
  params,
}: PageProps) {
  const { key } = await params;

  return (
    <div className="scoreboard-overlay-root">
      <ScoreboardOverlay overlayKey={key} />
      <style>{`
        .scoreboard-overlay-root > div > section {
          row-gap: clamp(10px, .82vw, 16px) !important;
        }

        .scoreboard-overlay-root > div > section > section {
          column-gap: clamp(10px, .82vw, 16px) !important;
        }
      `}</style>
    </div>
  );
}
