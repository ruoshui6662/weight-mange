export const RECIPE_CALC_VERSION = "recipe_yield_v1" as const;

export class RecipeError extends Error {
  constructor(readonly code: string, readonly details?: Record<string, unknown>) {
    super(code);
    this.name = "RecipeError";
  }
}
