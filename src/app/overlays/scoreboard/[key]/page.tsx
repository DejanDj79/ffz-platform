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
        .scoreboard-overlay-root > div > section > section:nth-of-type(2) > article:nth-child(2) > div > div > span {
          font-size: calc(clamp(6px, .55vw, 10px) + 3px) !important;
        }

        .scoreboard-overlay-root > div > section > section:nth-of-type(3) > article:nth-child(2) > div:first-of-type > div > span {
          font-size: calc(clamp(6px, .58vw, 10px) + 3px) !important;
        }
      `}</style>
    </div>
  );
}
