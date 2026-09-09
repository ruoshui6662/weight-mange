import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../src/api";

afterEach(() => vi.restoreAllMocks());

describe("web API client", () => {
  it("includes credentials and encodes dashboard dates", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: { date: "2026-09-09" } }), { status: 200 }));
    await api.getDashboard("2026-09-09");
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/dashboard/2026-09-09", expect.objectContaining({ credentials: "include" }));
  });

  it("surfaces machine-readable API errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: { code: "AUTH_REQUIRED", message: "AUTH_REQUIRED" } }), { status: 401 }));
    await expect(api.getSession()).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
  });
});
