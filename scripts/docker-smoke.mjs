import process from "node:process";

if (process.env.CI === "true") {
  console.log("docker smoke deferred: CI image stage is not available yet");
} else {
  console.log("docker smoke baseline: workspace is not containerized yet");
}
