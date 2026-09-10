import type { ReactNode } from "react";
import { DASHBOARD_TABS, type DashboardTab } from "../flow";

export function AppShell(props: { activeTab: DashboardTab; onNavigate: (tab: DashboardTab) => void; title: string; eyebrow?: string; primaryAction?: ReactNode; headerAction?: ReactNode; children: ReactNode; rail?: ReactNode }) {
  return <div className="dg-shell">
    <aside className="dg-sidebar" data-shell-sidebar><div className="dg-brand"><span className="brand-mark" aria-hidden="true">秤</span><span>Data Garden</span></div><ShellNav activeTab={props.activeTab} onNavigate={props.onNavigate} /></aside>
    <main className="dg-main"><header className="dg-page-header"><div><p className="eyebrow">{props.eyebrow ?? "NUTRITION TRACKER"}</p><h1>{props.title}</h1></div><div className="dg-page-actions">{props.headerAction}{props.primaryAction ? <div className="dg-page-action">{props.primaryAction}</div> : null}</div></header><div className="dg-workspace"><div className="dg-content">{props.children}</div>{props.rail ? <aside className="dg-context-rail" data-context-rail>{props.rail}</aside> : null}</div></main>
    <nav className="dg-bottom-nav" data-shell-bottom-nav aria-label="主导航"><ShellNav activeTab={props.activeTab} onNavigate={props.onNavigate} /></nav>
  </div>;
}

function ShellNav({ activeTab, onNavigate }: { activeTab: DashboardTab; onNavigate: (tab: DashboardTab) => void }) {
  return <>{DASHBOARD_TABS.map((tab) => <button type="button" key={tab.key} className={activeTab === tab.key ? "active" : ""} aria-current={activeTab === tab.key ? "page" : undefined} onClick={() => onNavigate(tab.key)}>{tab.label}</button>)}</>;
}
