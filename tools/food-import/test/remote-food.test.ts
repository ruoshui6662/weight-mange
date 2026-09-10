import { describe, expect, it } from "vitest";
import { fetchRemoteFoodDataset } from "../src/remote.js";

const directory = "json_data_v3_20260825_qwen38max_kimi_k3_fixed_en";
const apiUrl = `https://api.github.com/repos/ruoshui6662/china-food-composition-data/contents/${directory}?ref=main`;

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("remote food dataset bootstrap", () => {
  it("filters merged JSON files, merges records and emits reproducible metadata", async () => {
    const calls: string[] = [];
    const files = [
      { name: "README.md", type: "file", download_url: "https://raw.example/readme", sha: "readme" },
      { name: "merged_b.json", type: "file", download_url: "https://raw.example/b", sha: "b" },
      { name: "merged_a.json", type: "file", download_url: "https://raw.example/a", sha: "a" },
      { name: "food_composition_full.csv", type: "file", download_url: "https://raw.example/csv", sha: "csv" },
    ];
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      calls.push(url);
      if (url === apiUrl) return response(files);
      if (url === "https://raw.example/a") return response([{ foodCode: "A", foodName: "苹果", energyKCal: "52" }]);
      if (url === "https://raw.example/b") return response([{ foodCode: "B", foodName: "香蕉", energyKCal: "93" }]);
      throw new Error(`unexpected URL: ${url}`);
    };

    const result = await fetchRemoteFoodDataset({
      repository: "ruoshui6662/china-food-composition-data",
      ref: "main",
      directory,
      datasetKey: "cfcd6-ruoshui-fork",
      version: "20260825-fixed-en",
      sourceName: "China Food Composition Data (test fork)",
      fetchImpl,
    });

    expect(result.files).toEqual(["merged_a.json", "merged_b.json"]);
    expect(result.document.datasetKey).toBe("cfcd6-ruoshui-fork");
    expect(result.document.sourceUrl).toContain("ruoshui6662/china-food-composition-data");
    expect(result.document.foods).toEqual([
      { foodCode: "A", foodName: "苹果", energyKCal: "52" },
      { foodCode: "B", foodName: "香蕉", energyKCal: "93" },
    ]);
    expect(result.document.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(calls).toEqual([apiUrl, "https://raw.example/a", "https://raw.example/b"]);
  });

  it("rejects duplicate food codes instead of silently overwriting data", async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url === apiUrl) return response([{ name: "merged_a.json", type: "file", download_url: "https://raw.example/a", sha: "a" }, { name: "merged_b.json", type: "file", download_url: "https://raw.example/b", sha: "b" }]);
      return response([{ foodCode: "same", foodName: url.endsWith("/a") ? "苹果" : "香蕉" }]);
    };

    await expect(fetchRemoteFoodDataset({
      repository: "ruoshui6662/china-food-composition-data",
      ref: "main",
      directory,
      datasetKey: "cfcd6-ruoshui-fork",
      version: "20260825-fixed-en",
      sourceName: "China Food Composition Data (test fork)",
      fetchImpl,
    })).rejects.toThrow("REMOTE_FOOD_DUPLICATE_CODE:same");
  });
});
