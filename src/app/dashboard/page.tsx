import { DashboardFunded } from "@/components/dashboard/DashboardFunded";
import styles from "./DashboardHome.module.css";

export default function DashboardPage() {
  return (
    <div className={styles.dashboardPolish}>
      <DashboardFunded />
    </div>
  );
}
