import type { ReactNode } from "react";
import { DASHBOARD_TABS, type DashboardTab } from "../flow";

export function AppShell(props: { activeTab: DashboardTab; onNavigate: (tab: DashboardTab) => void; title: string; eyebrow?: string; primaryAction?: ReactNode; headerAction?: ReactNode; children: ReactNode; rail?: ReactNode }) {
  return <div className="dg-shell">
    <aside className="dg-sidebar" data-shell-sidebar><div className="dg-brand"><span className="brand-mark" aria-hidden="true">秤</span><span>Data Garden</span></div><ShellNav activeTab={props.activeTab} onNavigate={props.onNavigate} /></aside>
    <main className="dg-main"><header className="dg-page-header"><div><p className="eyebrow">{props.eyebrow ?? "NUTRITION TRACKER"}</p><h1>{props.title}</h1></div><div className="dg-page-actions">{props.headerAction}{props.primaryAction ? <div className="dg-page-action">{props.primaryAction}</div> : null}</div></header><div className={`dg-workspace ${props.rail ? "" : "dg-workspace-single"}`}><div className="dg-content">{props.children}</div>{props.rail ? <aside className="dg-context-rail" data-context-rail>{props.rail}</aside> : null}</div></main>
    <div className="dg-bottom-nav" data-shell-bottom-nav><ShellNav activeTab={props.activeTab} onNavigate={props.onNavigate} /></div>
  </div>;
}

function ShellNav({ activeTab, onNavigate }: { activeTab: DashboardTab; onNavigate: (tab: DashboardTab) => void }) {
  return <nav className="dg-nav" aria-label="主导航">{DASHBOARD_TABS.map((tab) => <button type="button" key={tab.key} className={activeTab === tab.key ? "active" : ""} aria-label={tab.label} aria-current={activeTab === tab.key ? "page" : undefined} onClick={() => onNavigate(tab.key)}><NavIcon tab={tab.key} /><span className="dg-nav-label">{tab.label}</span></button>)}</nav>;
}

function NavIcon({ tab }: { tab: DashboardTab }) {
  const paths: Record<DashboardTab, string> = { today: "M3 10.5 10 4l7 6.5v6a1 1 0 0 1-1 1h-3v-4H7v4H4a1 1 0 0 1-1-1z", diary: "M5 3h10a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm2 4h6M7 10h6M7 13h4", recipe: "M4 5h12M4 9h12M4 13h8M3 3h14v14H3z", weight: "M4 15h12M6 12h8M8 9h4M10 5v4", analytics: "M4 16V9m6 7V5m6 11v-9", profile: "M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5 7a5 5 0 0 1 10 0" };
  return <svg className="dg-nav-icon" data-nav-icon={tab} aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={paths[tab]} /></svg>;
}
