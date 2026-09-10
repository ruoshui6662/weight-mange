import { createHash } from "node:crypto";
import type { FoodImportDocument } from "./index.js";

const GITHUB_API = "https://api.github.com";
const USER_AGENT = "nutrition-tracker-food-bootstrap";

type GitHubContent = {
  name: string;
  type: string;
  download_url?: string | null;
};

export type RemoteFoodDatasetOptions = {
  repository: string;
  ref: string;
  directory: string;
  datasetKey: string;
  version: string;
  sourceName: string;
  fetchImpl?: typeof fetch;
};

export type RemoteFoodDatasetResult = {
  document: FoodImportDocument;
  files: string[];
};

function requestInit(): RequestInit {
  return {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": USER_AGENT,
    },
    signal: AbortSignal.timeout(30_000),
  };
}

async function readJson(response: Response, url: string): Promise<unknown> {
  if (!response.ok) throw new Error(`REMOTE_FOOD_HTTP_${response.status}:${url}`);
  return response.json() as Promise<unknown>;
}

async function readText(response: Response, url: string): Promise<string> {
  if (!response.ok) throw new Error(`REMOTE_FOOD_HTTP_${response.status}:${url}`);
  return response.text();
}

function apiDirectoryUrl(options: RemoteFoodDatasetOptions) {
  return `${GITHUB_API}/repos/${options.repository}/contents/${options.directory}?ref=${encodeURIComponent(options.ref)}`;
}

function sourceUrl(options: RemoteFoodDatasetOptions) {
  return `https://github.com/${options.repository}/tree/${options.ref}/${options.directory}`;
}

export async function fetchRemoteFoodDataset(options: RemoteFoodDatasetOptions): Promise<RemoteFoodDatasetResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const listingUrl = apiDirectoryUrl(options);
  const listingValue = await readJson(await fetchImpl(listingUrl, requestInit()), listingUrl);
  if (!Array.isArray(listingValue)) throw new Error("REMOTE_FOOD_DIRECTORY_INVALID");

  const files = listingValue
    .filter((item): item is GitHubContent => item !== null && typeof item === "object" && !Array.isArray(item))
    .filter((item) => item.type === "file" && item.name.startsWith("merged_") && item.name.endsWith(".json") && typeof item.download_url === "string")
    .sort((left, right) => left.name.localeCompare(right.name));
  if (files.length === 0) throw new Error("REMOTE_FOOD_DIRECTORY_EMPTY");

  const downloaded = await Promise.all(files.map(async (file) => {
    const url = file.download_url!;
    const raw = await readText(await fetchImpl(url, requestInit()), url);
    let value: unknown;
    try { value = JSON.parse(raw); } catch { throw new Error(`REMOTE_FOOD_JSON_INVALID:${file.name}`); }
    if (!Array.isArray(value)) throw new Error(`REMOTE_FOOD_FILE_NOT_ARRAY:${file.name}`);
    return { name: file.name, raw, foods: value };
  }));

  const seen = new Set<string>();
  const foods: Array<Record<string, unknown>> = [];
  for (const file of downloaded) {
    for (const item of file.foods) {
      if (item === null || typeof item !== "object" || Array.isArray(item)) throw new Error(`REMOTE_FOOD_RECORD_INVALID:${file.name}`);
      const food = item as Record<string, unknown>;
      const foodCode = typeof food.foodCode === "string" ? food.foodCode.trim() : "";
      if (!foodCode) throw new Error(`REMOTE_FOOD_CODE_MISSING:${file.name}`);
      if (seen.has(foodCode)) throw new Error(`REMOTE_FOOD_DUPLICATE_CODE:${foodCode}`);
      seen.add(foodCode);
      foods.push(food);
    }
  }

  const checksumInput = downloaded.map((file) => `${file.name}\n${file.raw}`).join("\n");
  const checksum = createHash("sha256").update(checksumInput).digest("hex");
  return {
    files: downloaded.map((file) => file.name),
    document: {
      datasetKey: options.datasetKey,
      version: options.version,
      sourceName: options.sourceName,
      checksum,
      sourceUrl: sourceUrl(options),
      sourceNotes: `Remote bootstrap from ${options.repository}@${options.ref}; merged JSON files: ${downloaded.length}`,
      foods,
    },
  };
}
