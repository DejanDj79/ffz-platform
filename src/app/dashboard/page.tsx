import { Dashboard } from "@/components/dashboard/Dashboard";
import styles from "./DashboardV2Layout.module.css";

export default function DashboardPage() {
  return (
    <div className={styles.dashboardV2}>
      <Dashboard />
    </div>
  );
}
