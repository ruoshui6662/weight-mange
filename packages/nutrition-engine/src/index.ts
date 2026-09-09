export const NUTRITION_ENGINE_VERSION = 1;

export const ALGORITHM_VERSIONS = {
  foodScale: "food_scale_v1",
  portionConversion: "portion_conversion_v1",
  displayRounding: "display_rounding_v1",
  energyEstimate: "energy_estimate_v1",
} as const;

export const ACTIVITY_FACTORS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  high: 1.725,
  very_high: 1.9,
} as const;

export type EnergyFormulaSex = "male" | "female";
export type EnergyActivityLevel = keyof typeof ACTIVITY_FACTORS;

export type BmrInput = {
  sex: EnergyFormulaSex;
  weightKg: number;
  heightCm: number;
  ageYears: number;
};

export type TdeeInput = BmrInput & { activityLevel: EnergyActivityLevel };

export type TargetCaloriesInput = {
  tdee: number;
  adjustmentKcal?: number;
  adjustmentPercent?: number;
};

export type NutrientStatus = "known" | "trace" | "unknown" | "estimated";

export type NutrientValue =
  | { status: "known" | "estimated"; value: number }
  | { status: "trace" | "unknown" };

export type NutrientValues = Record<string, NutrientValue>;

export type NutrientSummary = {
  amount: number;
  coverage: number;
  hasTrace: boolean;
  hasEstimated: boolean;
};

export type NutritionResult = {
  nutritionEngineVersion: typeof NUTRITION_ENGINE_VERSION;
  algorithmVersions: typeof ALGORITHM_VERSIONS;
  nutrients: Record<string, NutrientSummary>;
};

export type PortionInput = {
  amount: number;
  unit: "g" | "ml" | "serving";
  densityGramsPerMl?: number;
  gramsPerServing?: number;
  edibleRatio?: number;
};

export type ScaleNutrientsInput = {
  per100g: NutrientValues;
  amountGrams: number;
};

export type NutrientInput = {
  amountGrams: number;
  nutrients: NutrientValues;
};

function assertNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative finite number`);
  }
}

function assertPositiveFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number`);
  }
}

function assertEnergyInput(input: BmrInput): void {
  if (input.sex !== "male" && input.sex !== "female") {
    throw new RangeError("sex must be male or female");
  }
  assertPositiveFinite(input.weightKg, "weightKg");
  assertPositiveFinite(input.heightCm, "heightCm");
  assertPositiveFinite(input.ageYears, "ageYears");
}

export function calculateBmr(input: BmrInput): number {
  assertEnergyInput(input);
  const sexOffset = input.sex === "male" ? 5 : -161;
  return 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.ageYears + sexOffset;
}

export function calculateTdee(input: TdeeInput): number {
  if (!(input.activityLevel in ACTIVITY_FACTORS)) {
    throw new RangeError("activityLevel must be a supported activity level");
  }
  return calculateBmr(input) * ACTIVITY_FACTORS[input.activityLevel];
}

export function calculateTargetCalories(input: TargetCaloriesInput): number {
  assertPositiveFinite(input.tdee, "tdee");
  const hasKcal = input.adjustmentKcal !== undefined;
  const hasPercent = input.adjustmentPercent !== undefined;
  if (hasKcal && hasPercent) {
    throw new RangeError("provide one adjustment");
  }
  if (hasKcal) {
    assertNonNegativeFinite(Math.abs(input.adjustmentKcal!), "adjustmentKcal");
  }
  if (hasPercent && !Number.isFinite(input.adjustmentPercent)) {
    throw new RangeError("adjustmentPercent must be finite");
  }
  const target = hasKcal
    ? input.tdee + input.adjustmentKcal!
    : hasPercent
      ? input.tdee * (1 + input.adjustmentPercent!)
      : input.tdee;
  assertPositiveFinite(target, "targetCalories");
  return target;
}

function createResult(nutrients: Record<string, NutrientSummary>): NutritionResult {
  return {
    nutritionEngineVersion: NUTRITION_ENGINE_VERSION,
    algorithmVersions: ALGORITHM_VERSIONS,
    nutrients,
  };
}

export function convertPortionToGrams(input: PortionInput): number {
  assertNonNegativeFinite(input.amount, "amount");

  let grams: number;
  if (input.unit === "g") {
    grams = input.amount;
  } else if (input.unit === "ml") {
    if (input.densityGramsPerMl === undefined) {
      throw new RangeError("densityGramsPerMl is required for ml portions");
    }
    assertNonNegativeFinite(input.densityGramsPerMl, "densityGramsPerMl");
    grams = input.amount * input.densityGramsPerMl;
  } else {
    if (input.gramsPerServing === undefined) {
      throw new RangeError("gramsPerServing is required for serving portions");
    }
    assertNonNegativeFinite(input.gramsPerServing, "gramsPerServing");
    grams = input.amount * input.gramsPerServing;
  }

  if (input.edibleRatio === undefined) {
    return grams;
  }
  if (!Number.isFinite(input.edibleRatio) || input.edibleRatio < 0 || input.edibleRatio > 1) {
    throw new RangeError("edibleRatio must be a finite number between 0 and 1");
  }
  return grams * input.edibleRatio;
}

export function scaleNutrients(input: ScaleNutrientsInput): NutritionResult {
  assertNonNegativeFinite(input.amountGrams, "amountGrams");
  const scale = input.amountGrams / 100;
  const nutrients: Record<string, NutrientSummary> = {};

  for (const [nutrient, value] of Object.entries(input.per100g)) {
    if (value.status === "known" || value.status === "estimated") {
      assertNonNegativeFinite(value.value, `${nutrient}.value`);
    }
    nutrients[nutrient] = {
      amount: value.status === "known" || value.status === "estimated" ? value.value * scale : 0,
      coverage: value.status === "known" || value.status === "estimated" ? 1 : 0,
      hasTrace: value.status === "trace",
      hasEstimated: value.status === "estimated",
    };
  }
  return createResult(nutrients);
}

export function sumNutrients(inputs: readonly NutrientInput[]): NutritionResult {
  const totals = new Map<string, NutrientSummary & { relevantWeight: number; coveredWeight: number }>();

  for (const input of inputs) {
    assertNonNegativeFinite(input.amountGrams, "amountGrams");
    for (const [nutrient, value] of Object.entries(input.nutrients)) {
      if (value.status === "known" || value.status === "estimated") {
        assertNonNegativeFinite(value.value, `${nutrient}.value`);
      }
      const total = totals.get(nutrient) ?? {
        amount: 0,
        coverage: 0,
        hasTrace: false,
        hasEstimated: false,
        relevantWeight: 0,
        coveredWeight: 0,
      };
      total.relevantWeight += input.amountGrams;
      if (value.status === "known" || value.status === "estimated") {
        total.amount += value.value;
      }
      if (value.status === "known") {
        total.coveredWeight += input.amountGrams;
      }
      total.hasTrace ||= value.status === "trace";
      total.hasEstimated ||= value.status === "estimated";
      totals.set(nutrient, total);
    }
  }

  const nutrients: Record<string, NutrientSummary> = {};
  for (const [nutrient, total] of totals) {
    nutrients[nutrient] = {
      amount: total.amount,
      coverage: total.relevantWeight === 0 ? 1 : total.coveredWeight / total.relevantWeight,
      hasTrace: total.hasTrace,
      hasEstimated: total.hasEstimated,
    };
  }
  return createResult(nutrients);
}

export function roundForDisplay(nutrient: string, amount: number): number {
  if (!Number.isFinite(amount)) {
    throw new RangeError("amount must be a finite number");
  }
  if (nutrient === "energy_kcal") {
    return Math.round(amount);
  }
  if (nutrient.endsWith("_g") || nutrient === "body_weight_kg") {
    return roundToDecimals(amount, 1);
  }
  if (nutrient === "iron_mg") {
    return roundToDecimals(amount, 2);
  }
  return roundToDecimals(amount, 1);
}

function roundToDecimals(value: number, decimals: number): number {
  const multiplier = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}
