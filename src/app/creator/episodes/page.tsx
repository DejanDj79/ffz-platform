import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { canAccessCreatorTools } from "@/lib/auth/roles";
import { buildEpisodeSnapshot } from "@/lib/creator/episode-builder";
import {
  getCreatorEpisode,
  listCreatorEpisodes,
} from "@/lib/creator/episodes-repository";
import type { CreatorEpisodeApiModel } from "@/lib/creator/episodes-types";
import { buildCreatorScriptDraft } from "@/lib/creator/script-builder";
import { buildCreatorStorySuggestions } from "@/lib/creator/story-builder";
import { CopyEpisodeBrief } from "./CopyEpisodeBrief";
import { EpisodeDraftWorkspace } from "./EpisodeDraftWorkspace";
import { EpisodeWorkflowNav } from "./EpisodeWorkflowNav";
import { RecordingMode } from "./RecordingMode";
import { ScriptBuilder } from "./ScriptBuilder";
import { StoryBuilder } from "./StoryBuilder";
import styles from "./EpisodeBuilder.module.css";

type SearchParams = Promise<{
  from?: string;
  to?: string;
  challenge?: string;
  source?: string;
  episode?: string;
  step?: string;
}>;

type EpisodeStep = "brief" | "story" | "script" | "record";

function dateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function periodLabel(from: Date, to: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  return `${formatter.format(from)} → ${formatter.format(to)}`;
}

function episodeTitle(from: Date, to: Date, weekly: boolean) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const sameYear = from.getUTCFullYear() === to.getUTCFullYear();
  const fromLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" as const }),
    timeZone: "UTC",
  }).format(from);
  const toLabel = formatter.format(to);
  return `${weekly ? "FFZ Weekly Episode" : "FFZ Episode"} · ${fromLabel}–${toLabel}`;
}

function parseDate(value: string | undefined, fallback: Date, endOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  const suffix = endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z";
  const parsed = new Date(`${value}${suffix}`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function money(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function pnlClass(value: number) {
  if (value > 0) return styles.positive;
  if (value < 0) return styles.negative;
  return "";
}

function episodeStepHref(episode: CreatorEpisodeApiModel, step: EpisodeStep) {
  const params = new URLSearchParams({
    episode: episode.id,
    from: dateInputValue(new Date(episode.periodFrom)),
    to: dateInputValue(new Date(episode.periodTo)),
  });
  if (episode.challengeId) params.set("challenge", episode.challengeId);
  if (episode.source === "WEEKLY_REVIEW") params.set("source", "weekly-review");
  if (step !== "brief") params.set("step", step);
  return `/creator/episodes?${params.toString()}`;
}

export default async function CreatorEpisodesPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/creator/episodes");
  if (!canAccessCreatorTools(user)) redirect("/dashboard");

  const params = await searchParams;
  const now = new Date();
  const defaultTo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
  const defaultFrom = new Date(defaultTo);
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 6);
  defaultFrom.setUTCHours(0, 0, 0, 0);

  const requestedEpisode = params.episode
    ? await getCreatorEpisode(user.id, params.episode)
    : null;

  const parsedFrom = parseDate(params.from, defaultFrom);
  const parsedTo = parseDate(params.to, defaultTo, true);
  const validRange = parsedFrom.getTime() <= parsedTo.getTime();
  const queryFrom = validRange ? parsedFrom : defaultFrom;
  const queryTo = validRange ? parsedTo : defaultTo;

  const safeFrom = requestedEpisode ? new Date(requestedEpisode.periodFrom) : queryFrom;
  const safeTo = requestedEpisode ? new Date(requestedEpisode.periodTo) : queryTo;
  const fromWeeklyReview = requestedEpisode
    ? requestedEpisode.source === "WEEKLY_REVIEW"
    : params.source === "weekly-review";
  const challengeId = requestedEpisode
    ? requestedEpisode.challengeId
    : fromWeeklyReview ? null : params.challenge || null;
  const activeStep: EpisodeStep = requestedEpisode && params.step === "story"
    ? "story"
    : requestedEpisode && params.step === "script" && requestedEpisode.storyAngle
      ? "script"
      : requestedEpisode && params.step === "record" && requestedEpisode.script
        ? "record"
        : "brief";
  const filters = { from: safeFrom, to: safeTo, challengeId };

  const [snapshot, recentEpisodes, storySuggestions] = await Promise.all([
    buildEpisodeSnapshot(user.id, filters),
    listCreatorEpisodes(user.id, 6),
    activeStep === "story" || activeStep === "script"
      ? buildCreatorStorySuggestions(user.id, filters)
      : Promise.resolve([]),
  ]);

  const savedEpisodes = requestedEpisode && !recentEpisodes.some((episode) => episode.id === requestedEpisode.id)
    ? [requestedEpisode, ...recentEpisodes].slice(0, 7)
    : recentEpisodes;

  const scriptDraft = activeStep === "script" && requestedEpisode
    ? buildCreatorScriptDraft(requestedEpisode, snapshot, storySuggestions)
    : null;

  const challengePnl = snapshot.challenge
    ? snapshot.challenge.currentBalance - snapshot.challenge.startingBalance
    : null;
  const targetProgress = snapshot.challenge && snapshot.challenge.profitTarget > 0 && challengePnl != null
    ? Math.max(0, Math.min(100, (challengePnl / snapshot.challenge.profitTarget) * 100))
    : null;

  return (
    <main className={styles.page}>
      <form className={styles.filters} method="get">
        <div className={styles.periodContext}>
          <span>EPISODE PERIOD</span>
          <strong>{periodLabel(safeFrom, safeTo)}</strong>
          <small>{fromWeeklyReview ? "COMPLETE WEEK · ALL CLOSED JOURNAL TRADES" : "Build from the selected trading period and account scope."}</small>
        </div>

        {fromWeeklyReview ? (
          <>
            <input type="hidden" name="source" value="weekly-review" />
            <input type="hidden" name="from" value={dateInputValue(safeFrom)} />
            <input type="hidden" name="to" value={dateInputValue(safeTo)} />
            <div className={styles.weekLock}>
              <span>WEEKLY SOURCE</span>
              <strong>Weekly Review</strong>
              <small>Period and account scope are locked.</small>
            </div>
          </>
        ) : (
          <>
            <label>
              <span>FROM</span>
              <input type="date" name="from" defaultValue={dateInputValue(safeFrom)} />
            </label>
            <label>
              <span>TO</span>
              <input type="date" name="to" defaultValue={dateInputValue(safeTo)} />
            </label>
            <label className={styles.challengeFilter}>
              <span>CHALLENGE / FUNDED ACCOUNT</span>
              <select name="challenge" defaultValue={challengeId ?? ""}>
                <option value="">All trading activity</option>
                {snapshot.challenges.map((challenge) => (
                  <option key={challenge.id} value={challenge.id}>
                    {challenge.propFirm} · {challenge.name} · {challenge.status.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        <button type="submit">{fromWeeklyReview ? "REFRESH WEEK" : "BUILD SNAPSHOT"}</button>
      </form>

      <EpisodeDraftWorkspace
        key={requestedEpisode?.id ?? `${safeFrom.toISOString()}-${safeTo.toISOString()}-${challengeId ?? "all"}`}
        episodes={savedEpisodes}
        activeEpisodeId={requestedEpisode?.id ?? null}
        createInput={{
          challengeId,
          title: requestedEpisode?.title ?? episodeTitle(safeFrom, safeTo, fromWeeklyReview),
          source: fromWeeklyReview ? "WEEKLY_REVIEW" : "BUILDER",
          periodFrom: safeFrom.toISOString(),
          periodTo: safeTo.toISOString(),
          brief: snapshot.brief,
        }}
      />

      {requestedEpisode && (
        <EpisodeWorkflowNav
          briefHref={episodeStepHref(requestedEpisode, "brief")}
          storyHref={episodeStepHref(requestedEpisode, "story")}
          scriptHref={episodeStepHref(requestedEpisode, "script")}
          recordHref={episodeStepHref(requestedEpisode, "record")}
          activeStep={activeStep}
          storySaved={Boolean(requestedEpisode.storyAngle)}
          scriptSaved={Boolean(requestedEpisode.script)}
          recorded={requestedEpisode.status === "RECORDED"}
        />
      )}

      {activeStep === "story" && requestedEpisode ? (
        <StoryBuilder episode={requestedEpisode} suggestions={storySuggestions} />
      ) : activeStep === "script" && requestedEpisode && scriptDraft ? (
        <ScriptBuilder episode={requestedEpisode} draft={scriptDraft} />
      ) : activeStep === "record" && requestedEpisode && requestedEpisode.script ? (
        <RecordingMode episode={requestedEpisode} />
      ) : (
        <>
          <section className={styles.metricGrid}>
            <article className={styles.metricCard}>
              <span>NET P&amp;L</span>
              <strong className={pnlClass(snapshot.netPnl)}>{money(snapshot.netPnl)}</strong>
              <small>Closed trades in selected period</small>
            </article>
            <article className={styles.metricCard}>
              <span>TRADES</span>
              <strong>{snapshot.tradeCount}</strong>
              <small>
                {snapshot.wins}W · {snapshot.losses}L · {snapshot.breakeven}BE
                {snapshot.winRate == null ? "" : ` · ${snapshot.winRate.toFixed(1)}% WR`}
              </small>
            </article>
            <article className={styles.metricCard}>
              <span>AVERAGE R</span>
              <strong>{snapshot.averageR == null ? "—" : `${snapshot.averageR.toFixed(2)}R`}</strong>
              <small>${snapshot.totalRisk.toFixed(2)} recorded initial risk</small>
            </article>
            <article className={styles.metricCard}>
              <span>REAL MONEY NET</span>
              <strong className={pnlClass(snapshot.realMoneyNet)}>{money(snapshot.realMoneyNet)}</strong>
              <small>${snapshot.costs.toFixed(2)} costs · ${snapshot.payouts.toFixed(2)} payouts</small>
            </article>
          </section>

          <section className={styles.creatorGrid}>
            <article className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <span>STORY SIGNALS</span>
                  <h2>Talking points</h2>
                </div>
                {snapshot.topSetup && (
                  <div className={styles.setupChip}>
                    <span>TOP SETUP</span>
                    <strong>{snapshot.topSetup}</strong>
                  </div>
                )}
              </div>
              <ul className={styles.talkingPoints}>
                {snapshot.talkingPoints.map((point) => <li key={point}>{point}</li>)}
              </ul>
            </article>

            <section className={styles.briefCard}>
              <div className={styles.panelHeader}>
                <div>
                  <span>READY FOR NOTES / SCRIPT</span>
                  <h2>Episode brief</h2>
                </div>
                <CopyEpisodeBrief brief={snapshot.brief} />
              </div>
              <pre>{snapshot.brief}</pre>
            </section>
          </section>

          {snapshot.challenge && (
            <section className={styles.challengeCard}>
              <div className={styles.accountIdentity}>
                <span>SELECTED ACCOUNT</span>
                <strong>{snapshot.challenge.propFirm} · {snapshot.challenge.name}</strong>
                <small>{snapshot.challenge.phase.replaceAll("_", " ")} · {snapshot.challenge.status.replaceAll("_", " ")}</small>
              </div>
              <div>
                <span>CURRENT P&amp;L</span>
                <strong className={pnlClass(challengePnl ?? 0)}>{money(challengePnl ?? 0)}</strong>
                <small>{targetProgress == null ? "No target" : `${targetProgress.toFixed(0)}% of profit target`}</small>
              </div>
              <div>
                <span>CURRENT BALANCE</span>
                <strong>${snapshot.challenge.currentBalance.toFixed(2)}</strong>
                <small>Started at ${snapshot.challenge.startingBalance.toFixed(2)}</small>
              </div>
            </section>
          )}

          <section className={`${styles.panel} ${styles.tradeOrderPanel}`}>
            <div className={styles.panelHeader}>
              <div>
                <span>{fromWeeklyReview ? "WEEKLY TRADE ORDER" : "TRADE ORDER"}</span>
                <h2>{fromWeeklyReview ? "Every closed trade in recording order" : "Closed trades in recording order"}</h2>
              </div>
              <small>{snapshot.episodeTrades.length} {snapshot.episodeTrades.length === 1 ? "trade" : "trades"}</small>
            </div>
            {snapshot.episodeTrades.length > 0 ? (
              <div className={styles.tradeScroll}>
                <div className={styles.featuredTrades}>
                  {snapshot.episodeTrades.map((trade, index) => (
                    <div className={styles.tradeRow} key={trade.id}>
                      <span className={styles.tradeIndex}>{String(index + 1).padStart(2, "0")}</span>
                      <div className={styles.tradeMain}>
                        <strong>{trade.instrument} · {trade.direction}</strong>
                        <small>{trade.setup || "No setup label"}</small>
                      </div>
                      <span className={styles.tradeR}>{trade.rMultiple == null ? "—" : `${trade.rMultiple.toFixed(2)}R`}</span>
                      <b className={pnlClass(trade.netPnl)}>{money(trade.netPnl)}</b>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className={styles.empty}>No closed trades in this period.</p>
            )}
          </section>
        </>
      )}
    </main>
  );
}
