export function orderEpisodeTrades<
  T extends { closedAt: string | null; openedAt: string },
>(trades: T[]) {
  return [...trades].sort((a, b) => {
    const aTime = new Date(a.closedAt ?? a.openedAt).getTime();
    const bTime = new Date(b.closedAt ?? b.openedAt).getTime();
    return aTime - bTime;
  });
}
