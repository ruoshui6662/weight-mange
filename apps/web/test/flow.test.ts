import { describe, expect, it } from "vitest";
import { nextScreen } from "../src/flow";

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
});
