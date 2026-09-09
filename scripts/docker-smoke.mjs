import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const requiredFiles = ["Dockerfile", "docker-compose.yml", "scripts/healthcheck.mjs", ".github/workflows/ci.yml"];
for (const file of requiredFiles) {
  if (!existsSync(file)) {
    console.error(`docker smoke config missing: ${file}`);
    process.exit(1);
  }
}

const docker = spawnSync("docker", ["--version"], { stdio: "ignore" });
if (docker.status !== 0) {
  console.log("docker smoke blocked: Docker CLI is not installed in this environment");
  process.exit(0);
}

const result = spawnSync("docker", ["build", "--tag", "nutrition-tracker:smoke", "."], {
  stdio: "inherit",
});
process.exit(result.status ?? 1);
