export type EconomicImpact = "Low" | "Medium" | "High";

export type EconomicCalendarEvent = {
  id: string;
  category: string;
  date: string;
  title: string;
  description: string | null;

  country: string | null;
  currency: string | null;
  impact: EconomicImpact;

  previous: number | string | null;
  forecast: number | string | null;
  actual: number | string | null;
  unit: string | null;
};

export type EconomicCalendarPayload = {
  events: EconomicCalendarEvent[];
  range: {
    from: string;
    to: string;
  };

  provider: "Forex Factory";

  fetchedAt: string;
  expiresAt: string;
  stale: boolean;
};

export type ForexFactoryEvent = {
  title: string;
  country: string;
  date: string;
  impact: string;
  forecast?: string | null;
  previous?: string | null;
  actual?: string | null;
};
