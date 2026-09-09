import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

export type SexForFormula = "male" | "female" | "none";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "high" | "very_high";
export type GoalType = "maintain" | "loss" | "gain";
export type GoalSource = "manual" | "formula" | "adaptive";

export type ProfileErrorCode = "PROFILE_NOT_FOUND" | "PROFILE_INVALID_INPUT" | "PROFILE_GOAL_CONFLICT";

export class ProfileError extends Error {
  readonly code: ProfileErrorCode;

  constructor(code: ProfileErrorCode, options?: ErrorOptions) {
    super(code, options);
    this.name = "ProfileError";
    this.code = code;
  }
}

export type Profile = {
  id: string;
  displayName: string;
  timezone: string;
  unitSystem: "metric" | "imperial";
  body: {
    birthDate: string | null;
    sexForFormula: SexForFormula | null;
    heightCm: number | null;
    activityLevel: ActivityLevel | null;
  } | null;
};

export type NutritionGoal = {
  id: string;
  userId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  goalType: GoalType;
  calorieTargetKcal: number;
  proteinTargetG: number | null;
  fatTargetG: number | null;
  carbTargetG: number | null;
  fiberTargetG: number | null;
  source: GoalSource;
};

type ProfilePatch = Partial<Pick<Profile, "displayName" | "timezone">> & {
  birthDate?: string | null;
  sexForFormula?: SexForFormula | null;
  heightCm?: number | null;
  activityLevel?: ActivityLevel | null;
};

type GoalInput = {
  goalType: GoalType;
  calorieTargetKcal: number;
  proteinTargetG?: number | null;
  fatTargetG?: number | null;
  carbTargetG?: number | null;
  fiberTargetG?: number | null;
  effectiveFrom: string;
  source: GoalSource;
  now?: number;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SEX_VALUES = new Set<SexForFormula>(["male", "female", "none"]);
const ACTIVITY_VALUES = new Set<ActivityLevel>(["sedentary", "light", "moderate", "high", "very_high"]);
const GOAL_VALUES = new Set<GoalType>(["maintain", "loss", "gain"]);
const SOURCE_VALUES = new Set<GoalSource>(["manual", "formula", "adaptive"]);

function validDate(value: string | null | undefined) {
  if (value === null || value === undefined) return value === null;
  if (!DATE_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  return date.toISOString().slice(0, 10) === value;
}

function previousDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function nullableNonNegative(value: number | null | undefined) {
  return value === undefined || value === null || (Number.isFinite(value) && value >= 0);
}

function rowToProfile(row: Record<string, unknown>, body: Record<string, unknown> | undefined): Profile {
  return {
    id: String(row.id),
    displayName: String(row.display_name),
    timezone: String(row.timezone),
    unitSystem: row.unit_system as Profile["unitSystem"],
    body: body === undefined
      ? null
      : {
          birthDate: (body.birth_date as string | null) ?? null,
          sexForFormula: (body.sex_for_formula as SexForFormula | null) ?? null,
          heightCm: (body.height_cm as number | null) ?? null,
          activityLevel: (body.activity_level as ActivityLevel | null) ?? null,
        },
  };
}

function rowToGoal(row: Record<string, unknown>): NutritionGoal {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    effectiveFrom: String(row.effective_from),
    effectiveTo: (row.effective_to as string | null) ?? null,
    goalType: row.goal_type as GoalType,
    calorieTargetKcal: Number(row.calorie_target_kcal),
    proteinTargetG: (row.protein_target_g as number | null) ?? null,
    fatTargetG: (row.fat_target_g as number | null) ?? null,
    carbTargetG: (row.carb_target_g as number | null) ?? null,
    fiberTargetG: (row.fiber_target_g as number | null) ?? null,
    source: row.source as GoalSource,
  };
}

export function createProfileService(sqlite: DatabaseSync) {
  function ensureUser(userId: string) {
    const exists = sqlite.prepare("SELECT 1 AS ok FROM profile_user WHERE id = ? LIMIT 1").get(userId);
    if (exists === undefined) throw new ProfileError("PROFILE_NOT_FOUND");
  }

  function getProfile(userId: string): Profile {
    const row = sqlite.prepare("SELECT id, display_name, timezone, unit_system FROM profile_user WHERE id = ? LIMIT 1").get(userId) as Record<string, unknown> | undefined;
    if (row === undefined) throw new ProfileError("PROFILE_NOT_FOUND");
    const body = sqlite.prepare("SELECT birth_date, sex_for_formula, height_cm, activity_level FROM profile_body_profile WHERE user_id = ? LIMIT 1").get(userId) as Record<string, unknown> | undefined;
    return rowToProfile(row, body);
  }

  function updateProfile(userId: string, patch: ProfilePatch): Profile {
    ensureUser(userId);
    const current = getProfile(userId);
    const displayName = patch.displayName === undefined ? current.displayName : patch.displayName.trim();
    const timezone = patch.timezone === undefined ? current.timezone : patch.timezone.trim();
    if (displayName.length === 0 || timezone.length === 0) throw new ProfileError("PROFILE_INVALID_INPUT");
    if (patch.birthDate !== undefined && patch.birthDate !== null && !validDate(patch.birthDate)) throw new ProfileError("PROFILE_INVALID_INPUT");
    if (patch.sexForFormula !== undefined && patch.sexForFormula !== null && !SEX_VALUES.has(patch.sexForFormula)) throw new ProfileError("PROFILE_INVALID_INPUT");
    if (patch.activityLevel !== undefined && patch.activityLevel !== null && !ACTIVITY_VALUES.has(patch.activityLevel)) throw new ProfileError("PROFILE_INVALID_INPUT");
    if (patch.heightCm !== undefined && patch.heightCm !== null && (!Number.isFinite(patch.heightCm) || patch.heightCm <= 0)) throw new ProfileError("PROFILE_INVALID_INPUT");
    const now = Date.now();
    sqlite.exec("BEGIN IMMEDIATE");
    try {
      sqlite.prepare("UPDATE profile_user SET display_name = ?, timezone = ?, updated_at = ? WHERE id = ?").run(displayName, timezone, now, userId);
      const bodyChanged = patch.birthDate !== undefined || patch.sexForFormula !== undefined || patch.heightCm !== undefined || patch.activityLevel !== undefined;
      if (bodyChanged) {
        const body = current.body ?? { birthDate: null, sexForFormula: null, heightCm: null, activityLevel: null };
        sqlite.prepare(`
          INSERT INTO profile_body_profile (user_id, birth_date, sex_for_formula, height_cm, activity_level, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET birth_date = excluded.birth_date, sex_for_formula = excluded.sex_for_formula, height_cm = excluded.height_cm, activity_level = excluded.activity_level, updated_at = excluded.updated_at
        `).run(userId, patch.birthDate === undefined ? body.birthDate : patch.birthDate, patch.sexForFormula === undefined ? body.sexForFormula : patch.sexForFormula, patch.heightCm === undefined ? body.heightCm : patch.heightCm, patch.activityLevel === undefined ? body.activityLevel : patch.activityLevel, now);
      }
      sqlite.exec("COMMIT");
    } catch (error) {
      sqlite.exec("ROLLBACK");
      throw error;
    }
    return getProfile(userId);
  }

  function listGoals(userId: string) {
    ensureUser(userId);
    const rows = sqlite.prepare("SELECT id, user_id, effective_from, effective_to, goal_type, calorie_target_kcal, protein_target_g, fat_target_g, carb_target_g, fiber_target_g, source FROM profile_nutrition_goal WHERE user_id = ? ORDER BY effective_from, created_at").all(userId) as Record<string, unknown>[];
    return rows.map(rowToGoal);
  }

  function createGoal(userId: string, input: GoalInput) {
    ensureUser(userId);
    if (!GOAL_VALUES.has(input.goalType) || !SOURCE_VALUES.has(input.source) || !validDate(input.effectiveFrom) || !Number.isFinite(input.calorieTargetKcal) || input.calorieTargetKcal <= 0 || !nullableNonNegative(input.proteinTargetG) || !nullableNonNegative(input.fatTargetG) || !nullableNonNegative(input.carbTargetG) || !nullableNonNegative(input.fiberTargetG)) throw new ProfileError("PROFILE_INVALID_INPUT");
    const active = sqlite.prepare("SELECT id, effective_from FROM profile_nutrition_goal WHERE user_id = ? AND effective_to IS NULL LIMIT 1").get(userId) as { id: string; effective_from: string } | undefined;
    if (active !== undefined && active.effective_from >= input.effectiveFrom) throw new ProfileError("PROFILE_GOAL_CONFLICT");
    const now = input.now ?? Date.now();
    const id = randomUUID();
    sqlite.exec("BEGIN IMMEDIATE");
    try {
      if (active !== undefined) sqlite.prepare("UPDATE profile_nutrition_goal SET effective_to = ? WHERE id = ?").run(previousDate(input.effectiveFrom), active.id);
      sqlite.prepare("INSERT INTO profile_nutrition_goal (id, user_id, effective_from, effective_to, goal_type, calorie_target_kcal, protein_target_g, fat_target_g, carb_target_g, fiber_target_g, source, created_at) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)").run(id, userId, input.effectiveFrom, input.goalType, input.calorieTargetKcal, input.proteinTargetG ?? null, input.fatTargetG ?? null, input.carbTargetG ?? null, input.fiberTargetG ?? null, input.source, now);
      sqlite.exec("COMMIT");
    } catch (error) {
      sqlite.exec("ROLLBACK");
      throw error;
    }
    return listGoals(userId).find((goal) => goal.id === id)!;
  }

  return { getProfile, updateProfile, listGoals, createGoal };
}
