export type Screen = "loading" | "bootstrap" | "login" | "setup" | "dashboard";

export type DashboardTab = "today" | "diary" | "recipe" | "weight" | "analytics" | "profile";

export const DASHBOARD_TABS: ReadonlyArray<{ key: DashboardTab; label: string; status: "ready" | "planned" }> = [
  { key: "today", label: "今日", status: "ready" },
  { key: "diary", label: "饮食", status: "ready" },
  { key: "recipe", label: "菜谱", status: "ready" },
  { key: "weight", label: "体重", status: "planned" },
  { key: "analytics", label: "分析", status: "planned" },
  { key: "profile", label: "我的", status: "ready" },
];

const dashboardTabKeys = new Set<DashboardTab>(DASHBOARD_TABS.map((tab) => tab.key));

export function normalizeDashboardTab(value: string): DashboardTab {
  return dashboardTabKeys.has(value as DashboardTab) ? value as DashboardTab : "today";
}

export type FlowEvent =
  | { type: "status"; initialized: boolean }
  | { type: "bootstrapped" }
  | { type: "loggedIn" }
  | { type: "session"; authenticated: boolean; profileReady: boolean; goalReady: boolean }
  | { type: "setupSaved" }
  | { type: "logout" };

export function nextScreen(current: Screen, event: FlowEvent): Screen {
  if (event.type === "status") return event.initialized ? "login" : "bootstrap";
  if (event.type === "bootstrapped" || event.type === "loggedIn") return "setup";
  if (event.type === "session") return event.authenticated ? (event.profileReady && event.goalReady ? "dashboard" : "setup") : current === "bootstrap" ? "bootstrap" : "login";
  if (event.type === "setupSaved") return "dashboard";
  if (event.type === "logout") return "login";
  return current;
}

export function offlineLabel(online: boolean) {
  return online ? "" : "当前离线：已打开的页面仍可查看，恢复网络后可以继续保存。";
}
