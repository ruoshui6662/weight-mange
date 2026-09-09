import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { localDateFromEpoch } from "@nutrition-tracker/core";

export type WeightSource = "manual" | "import";

export type Weight = {
  id: string;
  userId: string;
  measuredAt: string;
  localDate: string;
  weightKg: number;
  source: WeightSource;
  note: string | null;
  version: number;
};

export type CreateWeightInput = {
  userId: string;
  measuredAt: string;
  weightKg: number;
  source?: WeightSource;
  note?: string | null;
};

export type UpdateWeightInput = {
  userId: string;
  id: string;
  measuredAt?: string;
  weightKg?: number;
  note?: string | null;
  version: number;
};

export class BodyError extends Error {
  constructor(readonly code: "BODY_NOT_FOUND" | "BODY_INVALID_INPUT" | "BODY_VERSION_CONFLICT") {
    super(code);
    this.name = "BodyError";
  }
}

type Options = { now?: () => number; id?: () => string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const OFFSET_RE = /(Z|[+-]\d{2}:\d{2})$/;
const SOURCES = new Set<WeightSource>(["manual", "import"]);

function validDate(value: string) {
  if (!DATE_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function measuredAtEpoch(value: string) {
  if (typeof value !== "string" || !OFFSET_RE.test(value)) throw new BodyError("BODY_INVALID_INPUT");
  const epoch = Date.parse(value);
  if (!Number.isFinite(epoch)) throw new BodyError("BODY_INVALID_INPUT");
  return epoch;
}

function positiveWeight(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function rowToWeight(row: Record<string, unknown>): Weight {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    measuredAt: new Date(Number(row.measured_at)).toISOString(),
    localDate: String(row.local_date),
    weightKg: Number(row.weight_kg),
    source: row.source as WeightSource,
    note: (row.note as string | null) ?? null,
    version: Number(row.version),
  };
}

export function createBodyService(sqlite: DatabaseSync, options: Options = {}) {
  const now = options.now ?? Date.now;
  const id = options.id ?? randomUUID;

  function userTimezone(userId: string) {
    const row = sqlite.prepare("SELECT timezone FROM profile_user WHERE id = ? LIMIT 1").get(userId) as { timezone: string } | undefined;
    if (row === undefined) throw new BodyError("BODY_NOT_FOUND");
    return row.timezone;
  }

  function normalizeInput(input: { userId: string; measuredAt: string; weightKg: number; source?: WeightSource; note?: string | null }) {
    if (!input || typeof input.userId !== "string" || input.userId.length === 0 || !positiveWeight(input.weightKg)) throw new BodyError("BODY_INVALID_INPUT");
    const epoch = measuredAtEpoch(input.measuredAt);
    const source = input.source ?? "manual";
    if (!SOURCES.has(source)) throw new BodyError("BODY_INVALID_INPUT");
    const timezone = userTimezone(input.userId);
    let localDate: string;
    try {
      localDate = localDateFromEpoch(epoch, timezone);
    } catch (error) {
      void error;
      throw new BodyError("BODY_INVALID_INPUT");
    }
    return { epoch, localDate, source, note: input.note ?? null };
  }

  function getWeight(userId: string, weightId: string) {
    const row = sqlite.prepare("SELECT id,user_id,measured_at,local_date,weight_kg,source,note,version FROM body_weight_entry WHERE id=? AND user_id=? LIMIT 1").get(weightId, userId) as Record<string, unknown> | undefined;
    if (row === undefined) throw new BodyError("BODY_NOT_FOUND");
    return rowToWeight(row);
  }

  function createWeight(input: CreateWeightInput) {
    const normalized = normalizeInput(input);
    const timestamp = now();
    const weightId = id();
    sqlite.prepare("INSERT INTO body_weight_entry (id,user_id,measured_at,local_date,weight_kg,source,note,version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,0,?,?)").run(weightId, input.userId, normalized.epoch, normalized.localDate, input.weightKg, normalized.source, normalized.note, timestamp, timestamp);
    return getWeight(input.userId, weightId);
  }

  function listWeights(input: { userId: string; from?: string; to?: string; limit?: number }) {
    userTimezone(input.userId);
    if (input.from !== undefined && !validDate(input.from)) throw new BodyError("BODY_INVALID_INPUT");
    if (input.to !== undefined && !validDate(input.to)) throw new BodyError("BODY_INVALID_INPUT");
    if (input.from !== undefined && input.to !== undefined && input.from > input.to) throw new BodyError("BODY_INVALID_INPUT");
    const limit = input.limit ?? 100;
    if (!Number.isInteger(limit) || limit <= 0 || limit > 500) throw new BodyError("BODY_INVALID_INPUT");
    const rows = sqlite.prepare(`SELECT id,user_id,measured_at,local_date,weight_kg,source,note,version FROM body_weight_entry WHERE user_id=? AND (? IS NULL OR local_date>=?) AND (? IS NULL OR local_date<=?) ORDER BY measured_at ASC,id ASC LIMIT ?`).all(input.userId, input.from ?? null, input.from ?? null, input.to ?? null, input.to ?? null, limit) as Record<string, unknown>[];
    return rows.map(rowToWeight);
  }

  function updateWeight(input: UpdateWeightInput) {
    if (!Number.isInteger(input.version) || input.version < 0) throw new BodyError("BODY_INVALID_INPUT");
    const current = getWeight(input.userId, input.id);
    const normalized = input.measuredAt === undefined ? null : normalizeInput({ userId: input.userId, measuredAt: input.measuredAt, weightKg: input.weightKg ?? current.weightKg, note: input.note === undefined ? current.note : input.note });
    const weightKg = input.weightKg ?? current.weightKg;
    if (!positiveWeight(weightKg)) throw new BodyError("BODY_INVALID_INPUT");
    const timestamp = now();
    const result = sqlite.prepare("UPDATE body_weight_entry SET measured_at=?,local_date=?,weight_kg=?,note=?,version=version+1,updated_at=? WHERE id=? AND user_id=? AND version=?").run(normalized?.epoch ?? Date.parse(current.measuredAt), normalized?.localDate ?? current.localDate, weightKg, input.note === undefined ? current.note : input.note, timestamp, input.id, input.userId, input.version);
    if (result.changes !== 1) throw new BodyError("BODY_VERSION_CONFLICT");
    return getWeight(input.userId, input.id);
  }

  function deleteWeight(input: { userId: string; id: string; version: number }) {
    if (!Number.isInteger(input.version) || input.version < 0) throw new BodyError("BODY_INVALID_INPUT");
    const result = sqlite.prepare("DELETE FROM body_weight_entry WHERE id=? AND user_id=? AND version=?").run(input.id, input.userId, input.version);
    if (result.changes === 0) {
      getWeight(input.userId, input.id);
      throw new BodyError("BODY_VERSION_CONFLICT");
    }
  }

  return { createWeight, listWeights, updateWeight, deleteWeight };
}
