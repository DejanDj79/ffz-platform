import type { Metadata } from "next";
import { PasswordRecovery } from "@/components/auth/PasswordRecovery";

export const metadata: Metadata = {
  title: "Forgot password | FFZ",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function Page() {
  return <PasswordRecovery />;
}
