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

  it("accepts empty 204 responses for logout", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
    await expect(api.logout()).resolves.toBeUndefined();
  });

  it("encodes recipe ids and keeps credentials for recipe mutations", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: { id: "r/1" } }), { status: 200 }));
    await api.addRecipeToDiary("r/1", { date: "2026-09-09", mealSlotId: "dinner", amount: 165, unit: "g" });
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/recipes/r%2F1/add-to-diary", expect.objectContaining({ method: "POST", credentials: "include" }));
  });

  it("encodes recipe ids and keeps credentials for copy and refresh", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({ data: { id: "r/1" } }), { status: 200 }));
    await api.copyRecipe("r/1");
    expect(fetchMock).toHaveBeenLastCalledWith("/api/v1/recipes/r%2F1/copy", expect.objectContaining({ method: "POST", credentials: "include" }));
    await api.refreshRecipeIngredients("r/1", ["i/1"]);
    expect(fetchMock).toHaveBeenLastCalledWith("/api/v1/recipes/r%2F1/refresh-ingredients", expect.objectContaining({ method: "POST", credentials: "include" }));
  });
});
