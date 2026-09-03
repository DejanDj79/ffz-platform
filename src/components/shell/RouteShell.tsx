"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AppShell } from "./AppShell";

const PUBLIC_RISK_CALCULATOR_PATH = "/tools/risk-calculator";

export function RouteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPublicRiskCalculator = pathname === PUBLIC_RISK_CALCULATOR_PATH;
  const [calculatorAuthState, setCalculatorAuthState] = useState<
    "checking" | "authenticated" | "guest"
  >("checking");

  useEffect(() => {
    if (!isPublicRiskCalculator) {
      setCalculatorAuthState("checking");
      return;
    }

    let cancelled = false;

    async function checkCalculatorSession() {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        if (cancelled) return;
        setCalculatorAuthState(response.ok ? "authenticated" : "guest");
      } catch {
        if (!cancelled) setCalculatorAuthState("guest");
      }
    }

    void checkCalculatorSession();

    return () => {
      cancelled = true;
    };
  }, [isPublicRiskCalculator]);

  if (!isPublicRiskCalculator) {
    return <AppShell>{children}</AppShell>;
  }

  if (calculatorAuthState === "authenticated") {
    return <AppShell>{children}</AppShell>;
  }

  // The calculator itself is server-selected: authenticated users receive the
  // full FFZ calculator while guests receive the public, API-free variant.
  return <>{children}</>;
}
