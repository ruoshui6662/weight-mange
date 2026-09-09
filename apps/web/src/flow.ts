export type Screen = "loading" | "bootstrap" | "login" | "setup" | "dashboard";

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
