import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { canAccessCreatorTools } from "@/lib/auth/roles";
import { buildEpisodeSnapshot } from "@/lib/creator/episode-builder";
import { normalizeEpisodeTradeIds } from "@/lib/creator/episode-selection";
import { CopyEpisodeBrief } from "./CopyEpisodeBrief";
import styles from "./EpisodeBuilder.module.css";

type SearchParams = Promise<{
  from?: string;
  to?: string;
  challenge?: string;
  trades?: string;
  source?: string;
}>;

function dateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
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

  const from = parseDate(params.from, defaultFrom);
  const to = parseDate(params.to, defaultTo, true);
  const safeFrom = from.getTime() <= to.getTime() ? from : defaultFrom;
  const safeTo = from.getTime() <= to.getTime() ? to : defaultTo;
  const selectedTradeIds = normalizeEpisodeTradeIds(params.trades);
  const fromWeeklyReview = params.source === "weekly-review" && selectedTradeIds.length > 0;

  const snapshot = await buildEpisodeSnapshot(user.id, {
    from: safeFrom,
    to: safeTo,
    challengeId: params.challenge || null,
    selectedTradeIds,
  });

  const challengePnl = snapshot.challenge
    ? snapshot.challenge.currentBalance - snapshot.challenge.startingBalance
    : null;
  const targetProgress = snapshot.challenge && snapshot.challenge.profitTarget > 0 && challengePnl != null
    ? Math.max(0, Math.min(100, (challengePnl / snapshot.challenge.profitTarget) * 100))
    : null;

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>CREATOR · EPISODE BUILDER</span>
          <h1>Turn a trading period into a usable video brief.</h1>
          <p>
            {fromWeeklyReview
              ? "This snapshot came from Weekly Review. The weekly metrics stay intact while your selected trades are carried into the review queue and copied episode brief."
              : "Pick a period and optionally one challenge; FFZ builds the numbers, review trades and talking points from data you already entered."}
          </p>
        </div>
        <div className={styles.mvpBadge}>
          {fromWeeklyReview ? "CREATOR ONLY · WEEKLY REVIEW" : "CREATOR ONLY · MVP"}
        </div>
      </section>

      <form className={styles.filters} method="get">
        {selectedTradeIds.length > 0 && (
          <input type="hidden" name="trades" value={selectedTradeIds.join(",")} />
        )}
        {fromWeeklyReview && <input type="hidden" name="source" value="weekly-review" />}
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
          <select name="challenge" defaultValue={params.challenge ?? ""}>
            <option value="">All trading activity</option>
            {snapshot.challenges.map((challenge) => (
              <option key={challenge.id} value={challenge.id}>
                {challenge.propFirm} · {challenge.name} · {challenge.status.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">BUILD SNAPSHOT</button>
      </form>

      <section className={styles.metricGrid}>
        <article className={styles.metricCard}>
          <span>TRADES</span>
          <strong>{snapshot.tradeCount}</strong>
          <small>{snapshot.wins}W · {snapshot.losses}L · {snapshot.breakeven}BE</small>
        </article>
        <article className={styles.metricCard}>
          <span>NET P&amp;L</span>
          <strong className={pnlClass(snapshot.netPnl)}>{money(snapshot.netPnl)}</strong>
          <small>Closed trades in selected period</small>
        </article>
        <article className={styles.metricCard}>
          <span>WIN RATE</span>
          <strong>{snapshot.winRate == null ? "—" : `${snapshot.winRate.toFixed(1)}%`}</strong>
          <small>Wins vs. decided trades</small>
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
        <article className={styles.metricCard}>
          <span>TOP SETUP</span>
          <strong className={styles.setupValue}>{snapshot.topSetup ?? "—"}</strong>
          <small>Most-used recorded setup</small>
        </article>
      </section>

      {snapshot.challenge && (
        <section className={styles.challengeCard}>
          <div>
            <span>SELECTED ACCOUNT</span>
            <strong>{snapshot.challenge.propFirm} · {snapshot.challenge.name}</strong>
            <small>{snapshot.challenge.phase.replaceAll("_", " ")} · {snapshot.challenge.status.replaceAll("_", " ")}</small>
          </div>
          <div>
            <span>CURRENT CHALLENGE P&amp;L</span>
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

      <section className={styles.contentGrid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span>STORY SIGNALS</span>
              <h2>Talking points</h2>
            </div>
          </div>
          <ul className={styles.talkingPoints}>
            {snapshot.talkingPoints.map((point) => <li key={point}>{point}</li>)}
          </ul>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span>{snapshot.explicitTradeSelection ? "WEEKLY REVIEW SELECTION" : "REVIEW QUEUE"}</span>
              <h2>{snapshot.explicitTradeSelection ? "Selected trades" : "Trades worth opening"}</h2>
            </div>
          </div>
          {snapshot.featuredTrades.length > 0 ? (
            <div className={styles.featuredTrades}>
              {snapshot.featuredTrades.map((trade) => (
                <div className={styles.tradeRow} key={`${trade.id}-${trade.label}`}>
                  <div>
                    <span>{trade.label}</span>
                    <strong>{trade.instrument} · {trade.direction}</strong>
                    <small>{trade.setup || "No setup label"}{trade.rMultiple == null ? "" : ` · ${trade.rMultiple.toFixed(2)}R`}</small>
                  </div>
                  <b className={pnlClass(trade.netPnl)}>{money(trade.netPnl)}</b>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.empty}>
              {snapshot.explicitTradeSelection
                ? "None of the selected trades match the current period / account filter."
                : "No closed trades in this selection."}
            </p>
          )}
        </article>
      </section>

      <section className={styles.briefCard}>
        <div className={styles.panelHeader}>
          <div>
            <span>COPY INTO NOTES / SCRIPT</span>
            <h2>Episode brief</h2>
          </div>
          <CopyEpisodeBrief brief={snapshot.brief} />
        </div>
        <pre>{snapshot.brief}</pre>
      </section>

      <section className={styles.experimentNote}>
        <strong>Why this is intentionally small</strong>
        <p>
          Weekly Review can now hand a curated set of trades into this snapshot without introducing saved episodes or a new database model.
          Use the handoff in real channel work before we add episode statuses, thumbnails, YouTube URLs or other creator infrastructure.
        </p>
      </section>
    </main>
  );
}
