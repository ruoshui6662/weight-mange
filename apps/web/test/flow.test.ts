import { describe, expect, it } from "vitest";
import { DASHBOARD_TABS, nextScreen, normalizeDashboardTab, offlineLabel } from "../src/flow";

describe("onboarding flow", () => {
  it("routes an empty install to bootstrap and then setup", () => {
    expect(nextScreen("loading", { type: "status", initialized: false })).toBe("bootstrap");
    expect(nextScreen("bootstrap", { type: "bootstrapped" })).toBe("setup");
  });

  it("routes initialized installs to login and complete profiles to dashboard", () => {
    expect(nextScreen("loading", { type: "status", initialized: true })).toBe("login");
    expect(nextScreen("login", { type: "session", authenticated: true, profileReady: true, goalReady: true })).toBe("dashboard");
    expect(nextScreen("login", { type: "session", authenticated: true, profileReady: false, goalReady: false })).toBe("setup");
    expect(nextScreen("dashboard", { type: "logout" })).toBe("login");
  });

  it("has an explicit offline status message", () => {
    expect(offlineLabel(false)).toContain("当前离线");
    expect(offlineLabel(true)).toBe("");
  });

  it("defines observable dashboard tabs and planned boundaries", () => {
    expect(DASHBOARD_TABS.map((tab) => tab.key)).toEqual(["today", "diary", "weight", "analytics", "profile"]);
    expect(DASHBOARD_TABS.find((tab) => tab.key === "today")?.status).toBe("ready");
    expect(DASHBOARD_TABS.find((tab) => tab.key === "diary")?.status).toBe("ready");
    expect(DASHBOARD_TABS.find((tab) => tab.key === "profile")?.status).toBe("ready");
    expect(DASHBOARD_TABS.find((tab) => tab.key === "weight")?.status).toBe("planned");
    expect(DASHBOARD_TABS.find((tab) => tab.key === "analytics")?.status).toBe("planned");
  });

  it("normalizes unknown dashboard tab values to today", () => {
    expect(normalizeDashboardTab("diary")).toBe("diary");
    expect(normalizeDashboardTab("unknown")).toBe("today");
  });
});
