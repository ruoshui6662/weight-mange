export type FoodSearchStatus = "idle" | "loading" | "success" | "empty" | "error";

export function searchStatusForResults(resultCount: number): "success" | "empty" {
  return resultCount > 0 ? "success" : "empty";
}
